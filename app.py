from flask import Flask, render_template, request, jsonify, send_file
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import os, random, shutil, mimetypes, pathlib

app = Flask(__name__)
basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{os.path.join(basedir, "instance", "ekip.db")}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = 'emare-ekip-2026'
app.config['JSON_AS_ASCII'] = False

db = SQLAlchemy(app)

# ═══════════════════════════════════════════
#  MODELS
# ═══════════════════════════════════════════

class Project(db.Model):
    id          = db.Column(db.Integer, primary_key=True)
    name        = db.Column(db.String(100), nullable=False)
    code        = db.Column(db.String(20), unique=True)
    icon        = db.Column(db.String(10))
    color       = db.Column(db.String(7))
    description = db.Column(db.Text)
    path        = db.Column(db.String(500))
    teams       = db.relationship('Team', backref='project', lazy=True, cascade='all,delete')
    tasks       = db.relationship('Task', backref='project', lazy=True, cascade='all,delete')
    messages    = db.relationship('Message', backref='project', lazy=True, cascade='all,delete')

    def to_dict(self):
        return {
            'id': self.id, 'name': self.name, 'code': self.code,
            'icon': self.icon, 'color': self.color, 'description': self.description,
            'path': self.path,
            'team_count': len(self.teams),
            'member_count': sum(len(t.members) for t in self.teams),
            'task_count': len(self.tasks),
            'active_tasks': len([t for t in self.tasks if t.status != 'tamamlandi'])
        }


class Team(db.Model):
    id         = db.Column(db.Integer, primary_key=True)
    name       = db.Column(db.String(100), nullable=False)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)
    members    = db.relationship('Member', backref='team', lazy=True, cascade='all,delete')

    def to_dict(self):
        return {
            'id': self.id, 'name': self.name, 'project_id': self.project_id,
            'members': [m.to_dict() for m in self.members]
        }


class Member(db.Model):
    id           = db.Column(db.Integer, primary_key=True)
    name         = db.Column(db.String(100), nullable=False)
    role         = db.Column(db.String(100))
    team_id      = db.Column(db.Integer, db.ForeignKey('team.id'), nullable=False)
    avatar_color = db.Column(db.String(7))
    is_online    = db.Column(db.Boolean, default=False)

    def to_dict(self):
        return {
            'id': self.id, 'name': self.name, 'role': self.role,
            'team_id': self.team_id, 'avatar_color': self.avatar_color,
            'is_online': self.is_online,
            'team_name': self.team.name if self.team else None
        }


class Task(db.Model):
    id          = db.Column(db.Integer, primary_key=True)
    title       = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    project_id  = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)
    assigned_to = db.Column(db.Integer, db.ForeignKey('member.id'), nullable=True)
    status      = db.Column(db.String(20), default='yeni')
    priority    = db.Column(db.String(10), default='orta')
    deadline    = db.Column(db.DateTime, nullable=True)
    created_at  = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at  = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    assignee    = db.relationship('Member', foreign_keys=[assigned_to])

    def to_dict(self):
        return {
            'id': self.id, 'title': self.title, 'description': self.description,
            'project_id': self.project_id, 'assigned_to': self.assigned_to,
            'assignee_name': self.assignee.name if self.assignee else None,
            'assignee_color': self.assignee.avatar_color if self.assignee else None,
            'status': self.status, 'priority': self.priority,
            'deadline': self.deadline.isoformat() if self.deadline else None,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class Message(db.Model):
    id          = db.Column(db.Integer, primary_key=True)
    content     = db.Column(db.Text, nullable=False)
    project_id  = db.Column(db.Integer, db.ForeignKey('project.id'), nullable=False)
    sender_name = db.Column(db.String(100), default='Emre')
    msg_type    = db.Column(db.String(20), default='text')      # text, task, status, system
    task_id     = db.Column(db.Integer, db.ForeignKey('task.id'), nullable=True)
    created_at  = db.Column(db.DateTime, default=datetime.utcnow)
    task_ref    = db.relationship('Task', foreign_keys=[task_id])

    def to_dict(self):
        d = {
            'id': self.id, 'content': self.content, 'project_id': self.project_id,
            'sender_name': self.sender_name, 'msg_type': self.msg_type,
            'task_id': self.task_id, 'created_at': self.created_at.isoformat()
        }
        if self.task_id and self.task_ref:
            d['task'] = self.task_ref.to_dict()
        return d


# ═══════════════════════════════════════════
#  API ROUTES
# ═══════════════════════════════════════════

@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/projects')
def get_projects():
    return jsonify([p.to_dict() for p in Project.query.order_by(Project.id).all()])


@app.route('/api/projects', methods=['POST'])
def create_project():
    data = request.json
    name = data.get('name', '').strip()
    if not name:
        return jsonify({'error': 'Proje adı gerekli'}), 400

    code = data.get('code', name[:3].upper()).strip().upper()
    if Project.query.filter_by(code=code).first():
        return jsonify({'error': f'{code} kodu zaten kullanılıyor'}), 409

    icon = data.get('icon', '📦')
    color = data.get('color', '#5B5EA6')
    description = data.get('description', '')
    path = data.get('path', '').strip()

    # If path given, verify it exists
    if path and not os.path.isdir(path):
        # Try to create it
        try:
            os.makedirs(path, exist_ok=True)
        except Exception:
            return jsonify({'error': 'Proje dizini oluşturulamadı'}), 400

    p = Project(name=name, code=code, icon=icon, color=color, description=description, path=path or None)
    db.session.add(p)
    db.session.flush()

    # Auto-create default teams
    team_names = data.get('teams', ['Backend Takımı', 'Frontend Takımı'])
    for tn in team_names:
        db.session.add(Team(name=tn, project_id=p.id))

    msg = Message(
        content=f"🎉 {name} projesi oluşturuldu!",
        project_id=p.id, sender_name='Sistem', msg_type='system'
    )
    db.session.add(msg)
    db.session.commit()

    return jsonify(p.to_dict()), 201


@app.route('/api/projects/<int:pid>', methods=['PATCH'])
def update_project(pid):
    p = Project.query.get_or_404(pid)
    data = request.json
    if 'name' in data:        p.name = data['name'].strip()
    if 'code' in data:        p.code = data['code'].strip().upper()
    if 'icon' in data:        p.icon = data['icon']
    if 'color' in data:       p.color = data['color']
    if 'description' in data: p.description = data['description']
    if 'path' in data:        p.path = data['path'].strip() or None
    db.session.commit()
    return jsonify(p.to_dict())


@app.route('/api/projects/<int:pid>', methods=['DELETE'])
def delete_project(pid):
    p = Project.query.get_or_404(pid)
    name = p.name
    db.session.delete(p)
    db.session.commit()
    return jsonify({'ok': True, 'name': name})


@app.route('/api/projects/<int:pid>/teams', methods=['POST'])
def create_team(pid):
    Project.query.get_or_404(pid)
    data = request.json
    name = data.get('name', '').strip()
    if not name:
        return jsonify({'error': 'Takım adı gerekli'}), 400
    team = Team(name=name, project_id=pid)
    db.session.add(team)
    db.session.flush()
    msg = Message(
        content=f"👥 Yeni takım oluşturuldu: {name}",
        project_id=pid, sender_name='Sistem', msg_type='system'
    )
    db.session.add(msg)
    db.session.commit()
    return jsonify(team.to_dict()), 201


@app.route('/api/projects/<int:pid>/feed')
def get_feed(pid):
    after = request.args.get('after', 0, type=int)
    q = Message.query.filter_by(project_id=pid)
    if after:
        q = q.filter(Message.id > after)
    return jsonify([m.to_dict() for m in q.order_by(Message.created_at.asc()).limit(200).all()])


@app.route('/api/projects/<int:pid>/messages', methods=['POST'])
def send_message(pid):
    data = request.json
    msg = Message(
        content=data.get('content', ''),
        project_id=pid,
        sender_name=data.get('sender_name', 'Emre'),
        msg_type=data.get('msg_type', 'text')
    )
    db.session.add(msg)
    db.session.commit()
    return jsonify(msg.to_dict()), 201


@app.route('/api/projects/<int:pid>/teams')
def get_teams(pid):
    return jsonify([t.to_dict() for t in Team.query.filter_by(project_id=pid).all()])


@app.route('/api/projects/<int:pid>/tasks')
def get_tasks(pid):
    status = request.args.get('status')
    q = Task.query.filter_by(project_id=pid)
    if status:
        q = q.filter_by(status=status)
    return jsonify([t.to_dict() for t in q.order_by(Task.created_at.desc()).all()])


@app.route('/api/projects/<int:pid>/tasks', methods=['POST'])
def create_task(pid):
    data = request.json
    task = Task(
        title=data['title'],
        description=data.get('description', ''),
        project_id=pid,
        assigned_to=data.get('assigned_to') or None,
        priority=data.get('priority', 'orta'),
        deadline=datetime.fromisoformat(data['deadline']) if data.get('deadline') else None
    )
    db.session.add(task)
    db.session.flush()

    assignee_name = task.assignee.name if task.assignee else 'Atanmadı'
    pri_map = {'dusuk': '🟢', 'orta': '🟡', 'yuksek': '🟠', 'acil': '🔴'}
    msg = Message(
        content=f"📋 Yeni görev oluşturuldu: {task.title}\n👤 {assignee_name} · {pri_map.get(task.priority, '🟡')} {task.priority.capitalize()}",
        project_id=pid, sender_name='Emre', msg_type='task', task_id=task.id
    )
    db.session.add(msg)
    db.session.commit()
    return jsonify(task.to_dict()), 201


@app.route('/api/tasks/<int:tid>', methods=['PATCH'])
def update_task(tid):
    task = Task.query.get_or_404(tid)
    data = request.json
    old_status = task.status

    if 'title' in data:       task.title = data['title']
    if 'description' in data:  task.description = data['description']
    if 'assigned_to' in data:  task.assigned_to = data['assigned_to'] or None
    if 'status' in data:       task.status = data['status']
    if 'priority' in data:     task.priority = data['priority']
    if 'deadline' in data:
        task.deadline = datetime.fromisoformat(data['deadline']) if data['deadline'] else None
    task.updated_at = datetime.utcnow()

    if 'status' in data and data['status'] != old_status:
        emoji = {'yeni': '🆕', 'devam': '🔄', 'inceleme': '🔍', 'tamamlandi': '✅'}
        label = {'yeni': 'Yeni', 'devam': 'Devam Ediyor', 'inceleme': 'İnceleme', 'tamamlandi': 'Tamamlandı'}
        msg = Message(
            content=f"{emoji.get(data['status'], '📋')} \"{task.title}\" → {label.get(data['status'], data['status'])}",
            project_id=task.project_id, sender_name='Sistem', msg_type='status', task_id=task.id
        )
        db.session.add(msg)

    if 'assigned_to' in data and data.get('assigned_to'):
        member = Member.query.get(data['assigned_to'])
        if member:
            msg = Message(
                content=f"👤 \"{task.title}\" → {member.name}'e atandı",
                project_id=task.project_id, sender_name='Sistem', msg_type='status', task_id=task.id
            )
            db.session.add(msg)

    db.session.commit()
    return jsonify(task.to_dict())


@app.route('/api/tasks/<int:tid>', methods=['DELETE'])
def delete_task(tid):
    task = Task.query.get_or_404(tid)
    msg = Message(
        content=f"🗑️ Görev silindi: \"{task.title}\"",
        project_id=task.project_id, sender_name='Sistem', msg_type='system'
    )
    db.session.add(msg)
    Message.query.filter_by(task_id=tid).update({'task_id': None})
    db.session.delete(task)
    db.session.commit()
    return jsonify({'ok': True})


@app.route('/api/teams/<int:tid>/members', methods=['POST'])
def add_member(tid):
    data = request.json
    colors = ['#E74C3C','#3498DB','#2ECC71','#F39C12','#9B59B6','#1ABC9C','#E67E22','#34495E']
    member = Member(
        name=data['name'], role=data.get('role', 'Geliştirici'),
        team_id=tid, avatar_color=random.choice(colors), is_online=False
    )
    db.session.add(member)
    db.session.commit()
    team = Team.query.get(tid)
    if team:
        msg = Message(
            content=f"👋 {member.name} ({member.role}) {team.name}'a katıldı",
            project_id=team.project_id, sender_name='Sistem', msg_type='system'
        )
        db.session.add(msg)
        db.session.commit()
    return jsonify(member.to_dict()), 201


@app.route('/api/members/<int:mid>', methods=['PATCH'])
def update_member(mid):
    member = Member.query.get_or_404(mid)
    data = request.json
    if 'name' in data:      member.name = data['name']
    if 'role' in data:      member.role = data['role']
    if 'is_online' in data: member.is_online = data['is_online']
    if 'team_id' in data:   member.team_id = data['team_id']
    db.session.commit()
    return jsonify(member.to_dict())


@app.route('/api/members/<int:mid>', methods=['DELETE'])
def delete_member(mid):
    member = Member.query.get_or_404(mid)
    Task.query.filter_by(assigned_to=mid).update({'assigned_to': None})
    db.session.delete(member)
    db.session.commit()
    return jsonify({'ok': True})


@app.route('/api/stats')
def get_stats():
    projects = Project.query.all()
    total_members = Member.query.count()
    all_tasks = Task.query.all()
    status_map = {}
    for t in all_tasks:
        status_map[t.status] = status_map.get(t.status, 0) + 1

    project_stats = []
    for p in projects:
        tasks = [t for t in all_tasks if t.project_id == p.id]
        project_stats.append({
            'project': p.to_dict(),
            'yeni': len([t for t in tasks if t.status == 'yeni']),
            'devam': len([t for t in tasks if t.status == 'devam']),
            'inceleme': len([t for t in tasks if t.status == 'inceleme']),
            'tamamlandi': len([t for t in tasks if t.status == 'tamamlandi']),
        })

    return jsonify({
        'total_tasks': len(all_tasks),
        'active_tasks': len([t for t in all_tasks if t.status != 'tamamlandi']),
        'completed_tasks': status_map.get('tamamlandi', 0),
        'total_members': total_members,
        'by_status': status_map,
        'project_stats': project_stats
    })


# ═══════════════════════════════════════════
#  FILE MANAGEMENT API
# ═══════════════════════════════════════════

IGNORE_DIRS  = {'.git', 'node_modules', '__pycache__', '.venv', 'venv', '.venv3',
                'vendor', '.DS_Store', '.idea', '.vscode', '.cursor', 'instance',
                'storage/framework', 'bootstrap/cache', '__pypackages__'}
IGNORE_FILES = {'.DS_Store', 'Thumbs.db', '.env'}
TEXT_EXT     = {'.py','.js','.ts','.jsx','.tsx','.html','.css','.scss','.json',
                '.yml','.yaml','.md','.txt','.sh','.bash','.zsh','.sql','.xml',
                '.csv','.ini','.cfg','.conf','.toml','.env.example','.gitignore',
                '.lock','.php','.blade.php','.vue','.rb','.go','.rs','.c','.h',
                '.java','.kt','.swift','.dockerfile','.mdc','.plist','.log'}

def _get_project_path(pid):
    p = Project.query.get_or_404(pid)
    if not p.path or not os.path.isdir(p.path):
        return None, None
    return p, p.path

def _safe_path(root, rel):
    """Prevent path traversal"""
    full = os.path.normpath(os.path.join(root, rel))
    if not full.startswith(os.path.normpath(root)):
        return None
    return full

def _is_text(filepath):
    ext = pathlib.Path(filepath).suffix.lower()
    name = os.path.basename(filepath).lower()
    if ext in TEXT_EXT or name in ('.gitignore', 'Makefile', 'Dockerfile', 'Procfile'):
        return True
    if name.endswith('.blade.php'):
        return True
    return False

def _file_info(fullpath, root):
    rel = os.path.relpath(fullpath, root)
    name = os.path.basename(fullpath)
    is_dir = os.path.isdir(fullpath)
    info = {
        'name': name,
        'path': rel,
        'is_dir': is_dir,
    }
    if not is_dir:
        try:
            stat = os.stat(fullpath)
            info['size'] = stat.st_size
            info['modified'] = datetime.fromtimestamp(stat.st_mtime).isoformat()
        except:
            info['size'] = 0
            info['modified'] = None
        info['ext'] = pathlib.Path(name).suffix.lower()
        info['is_text'] = _is_text(fullpath)
    return info


@app.route('/api/projects/<int:pid>/files')
def list_files(pid):
    proj, root = _get_project_path(pid)
    if not root:
        return jsonify({'error': 'Proje dizini bulunamadı'}), 404

    rel = request.args.get('path', '')
    target = _safe_path(root, rel) if rel else root
    if not target or not os.path.isdir(target):
        return jsonify({'error': 'Klasör bulunamadı'}), 404

    items = []
    try:
        for name in sorted(os.listdir(target)):
            if name in IGNORE_FILES:
                continue
            fullp = os.path.join(target, name)
            if os.path.isdir(fullp) and name in IGNORE_DIRS:
                continue
            items.append(_file_info(fullp, root))
    except PermissionError:
        return jsonify({'error': 'Erişim reddedildi'}), 403

    # Dirs first, then files
    items.sort(key=lambda x: (not x['is_dir'], x['name'].lower()))

    return jsonify({
        'current_path': rel or '',
        'project_name': proj.name,
        'items': items
    })


@app.route('/api/projects/<int:pid>/file')
def read_file_content(pid):
    proj, root = _get_project_path(pid)
    if not root:
        return jsonify({'error': 'Proje dizini bulunamadı'}), 404

    rel = request.args.get('path', '')
    if not rel:
        return jsonify({'error': 'Dosya yolu belirtilmedi'}), 400

    target = _safe_path(root, rel)
    if not target or not os.path.isfile(target):
        return jsonify({'error': 'Dosya bulunamadı'}), 404

    info = _file_info(target, root)

    if not _is_text(target):
        return jsonify({**info, 'content': None, 'binary': True})

    try:
        with open(target, 'r', encoding='utf-8', errors='replace') as f:
            content = f.read(500_000)  # Max 500KB
        line_count = content.count('\n') + 1
        return jsonify({**info, 'content': content, 'binary': False, 'line_count': line_count})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/projects/<int:pid>/file', methods=['POST'])
def create_file_api(pid):
    proj, root = _get_project_path(pid)
    if not root:
        return jsonify({'error': 'Proje dizini bulunamadı'}), 404

    data = request.json
    rel = data.get('path', '')
    name = data.get('name', '')
    content = data.get('content', '')
    is_dir = data.get('is_dir', False)

    if not name:
        return jsonify({'error': 'Dosya adı gerekli'}), 400

    parent = _safe_path(root, rel) if rel else root
    if not parent:
        return jsonify({'error': 'Geçersiz yol'}), 400

    target = os.path.join(parent, name)
    if not target.startswith(os.path.normpath(root)):
        return jsonify({'error': 'Geçersiz yol'}), 400

    if os.path.exists(target):
        return jsonify({'error': 'Bu isimde dosya/klasör zaten var'}), 409

    try:
        if is_dir:
            os.makedirs(target, exist_ok=True)
        else:
            os.makedirs(os.path.dirname(target), exist_ok=True)
            with open(target, 'w', encoding='utf-8') as f:
                f.write(content)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

    # Log to chat
    kind = 'Klasör' if is_dir else 'Dosya'
    msg = Message(
        content=f"📁 {kind} oluşturuldu: {os.path.join(rel, name)}",
        project_id=pid, sender_name='Sistem', msg_type='system'
    )
    db.session.add(msg)
    db.session.commit()

    return jsonify(_file_info(target, root)), 201


@app.route('/api/projects/<int:pid>/file', methods=['PUT'])
def update_file_api(pid):
    proj, root = _get_project_path(pid)
    if not root:
        return jsonify({'error': 'Proje dizini bulunamadı'}), 404

    data = request.json
    rel = data.get('path', '')
    content = data.get('content', '')

    target = _safe_path(root, rel)
    if not target or not os.path.isfile(target):
        return jsonify({'error': 'Dosya bulunamadı'}), 404

    try:
        with open(target, 'w', encoding='utf-8') as f:
            f.write(content)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

    msg = Message(
        content=f"✏️ Dosya güncellendi: {rel}",
        project_id=pid, sender_name='Sistem', msg_type='system'
    )
    db.session.add(msg)
    db.session.commit()

    return jsonify(_file_info(target, root))


@app.route('/api/projects/<int:pid>/file', methods=['DELETE'])
def delete_file_api(pid):
    proj, root = _get_project_path(pid)
    if not root:
        return jsonify({'error': 'Proje dizini bulunamadı'}), 404

    rel = request.args.get('path', '')
    if not rel:
        return jsonify({'error': 'Dosya yolu belirtilmedi'}), 400

    target = _safe_path(root, rel)
    if not target or not os.path.exists(target):
        return jsonify({'error': 'Dosya/klasör bulunamadı'}), 404

    try:
        if os.path.isdir(target):
            shutil.rmtree(target)
        else:
            os.remove(target)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

    msg = Message(
        content=f"🗑️ Silindi: {rel}",
        project_id=pid, sender_name='Sistem', msg_type='system'
    )
    db.session.add(msg)
    db.session.commit()

    return jsonify({'ok': True})


@app.route('/api/files/share', methods=['POST'])
def share_file():
    data = request.json
    src_pid  = data.get('from_project')
    dst_pid  = data.get('to_project')
    src_path = data.get('src_path', '')
    dst_path = data.get('dst_path', '')

    src_proj, src_root = _get_project_path(src_pid)
    dst_proj, dst_root = _get_project_path(dst_pid)
    if not src_root or not dst_root:
        return jsonify({'error': 'Proje dizinleri bulunamadı'}), 404

    src_full = _safe_path(src_root, src_path)
    if not src_full or not os.path.exists(src_full):
        return jsonify({'error': 'Kaynak dosya bulunamadı'}), 404

    dst_dir = _safe_path(dst_root, dst_path) if dst_path else dst_root
    if not dst_dir:
        return jsonify({'error': 'Geçersiz hedef yol'}), 400

    dst_full = os.path.join(dst_dir, os.path.basename(src_full))

    # If exists, add suffix
    if os.path.exists(dst_full):
        base, ext = os.path.splitext(dst_full)
        dst_full = f"{base}_shared{ext}"

    try:
        os.makedirs(dst_dir, exist_ok=True)
        if os.path.isdir(src_full):
            shutil.copytree(src_full, dst_full)
        else:
            shutil.copy2(src_full, dst_full)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

    # Log in both projects
    fname = os.path.basename(src_full)
    msg1 = Message(
        content=f"📤 \"{fname}\" → {dst_proj.name} projesine paylaşıldı",
        project_id=src_pid, sender_name='Sistem', msg_type='system'
    )
    msg2 = Message(
        content=f"📥 \"{fname}\" ← {src_proj.name} projesinden alındı",
        project_id=dst_pid, sender_name='Sistem', msg_type='system'
    )
    db.session.add_all([msg1, msg2])
    db.session.commit()

    return jsonify({'ok': True, 'dest': os.path.relpath(dst_full, dst_root)})


@app.route('/api/projects/<int:pid>/file/download')
def download_file(pid):
    proj, root = _get_project_path(pid)
    if not root:
        return jsonify({'error': 'Proje dizini bulunamadı'}), 404

    rel = request.args.get('path', '')
    target = _safe_path(root, rel)
    if not target or not os.path.isfile(target):
        return jsonify({'error': 'Dosya bulunamadı'}), 404

    return send_file(target, as_attachment=True)


@app.route('/api/projects/<int:pid>/search-files')
def search_files(pid):
    proj, root = _get_project_path(pid)
    if not root:
        return jsonify({'error': 'Proje dizini bulunamadı'}), 404

    q = request.args.get('q', '').lower().strip()
    if not q or len(q) < 2:
        return jsonify([])

    results = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in IGNORE_DIRS]
        for name in filenames:
            if name in IGNORE_FILES:
                continue
            if q in name.lower():
                fullp = os.path.join(dirpath, name)
                results.append(_file_info(fullp, root))
                if len(results) >= 50:
                    return jsonify(results)
    return jsonify(results)


# ═══════════════════════════════════════════
#  SEED DATA
# ═══════════════════════════════════════════

DESKTOP = os.path.expanduser('~/Desktop')

def seed_data():
    if Project.query.first():
        return

    projects_data = [
        {'name': 'Emare Finance',  'code': 'FIN', 'icon': '💰', 'color': '#27AE60',
         'description': 'Multi-tenant POS/ERP — Satış, stok, cari, e-fatura, modüler yapı',
         'path': os.path.join(DESKTOP, 'Emare Finance')},
        {'name': 'Emare Asistan',  'code': 'AST', 'icon': '🤖', 'color': '#3498DB',
         'description': 'AI sohbet asistanı — WhatsApp, Telegram, Instagram entegrasyonu',
         'path': os.path.join(DESKTOP, 'asistan')},
        {'name': 'EmareCloud',     'code': 'CLD', 'icon': '☁️', 'color': '#9B59B6',
         'description': 'Sunucu yönetim paneli — SSH terminal, monitoring, uygulama pazarı',
         'path': os.path.join(DESKTOP, 'emarecloud')},
        {'name': 'EmareHup',       'code': 'HUB', 'icon': '🏭', 'color': '#F39C12',
         'description': 'Yazılım fabrikası — modül orkestrasyonu, kod üretimi',
         'path': os.path.join(DESKTOP, 'EmareHup')},
        {'name': 'SiberEmare',     'code': 'SBR', 'icon': '🛡️', 'color': '#E74C3C',
         'description': 'Pentest rapor asistanı — RAG tabanlı güvenlik analizi',
         'path': os.path.join(DESKTOP, 'SiberEmare')},
        {'name': 'DevM Platform',  'code': 'DVM', 'icon': '⚡', 'color': '#1ABC9C',
         'description': 'Otonom geliştirme platformu — AI multi-agent kod üretimi',
         'path': os.path.join(DESKTOP, 'EmareHup', 'DevM')},
    ]

    team_pairs = [
        ('Backend Takımı',   'Frontend Takımı'),
        ('AI / Core Takımı', 'Entegrasyon Takımı'),
        ('Altyapı Takımı',   'Arayüz Takımı'),
        ('Core Takımı',      'Platform Takımı'),
        ('Güvenlik Takımı',  'Analiz Takımı'),
        ('Engine Takımı',    'IDE Takımı'),
    ]

    names_a = ['Ahmet Yılmaz','Mehmet Kaya','Mustafa Demir','Ali Çelik','Hüseyin Şahin',
               'İbrahim Yıldız','Hasan Öztürk','Ömer Aydın','Yusuf Kılıç','Burak Arslan']
    names_b = ['Ayşe Koç','Fatma Çetin','Zeynep Kurt','Elif Aksoy','Merve Özkan',
               'Büşra Doğan','Selin Yılmaz','Ecem Polat','Deniz Acar','Ceren Erdoğan']

    roles = ['Takım Lideri','Kıdemli Geliştirici','Kıdemli Geliştirici','Full-Stack Geliştirici',
             'Full-Stack Geliştirici','Geliştirici','Geliştirici','Junior Geliştirici',
             'QA / Test Uzmanı','DevOps Mühendisi']

    colors = ['#E74C3C','#3498DB','#2ECC71','#F39C12','#9B59B6',
              '#1ABC9C','#E67E22','#34495E','#16A085','#C0392B']

    for i, pd in enumerate(projects_data):
        p = Project(**pd)
        db.session.add(p)
        db.session.flush()

        for j, tn in enumerate(team_pairs[i]):
            t = Team(name=tn, project_id=p.id)
            db.session.add(t)
            db.session.flush()
            names = names_a if j == 0 else names_b
            for k, nm in enumerate(names):
                db.session.add(Member(
                    name=nm, role=roles[k], team_id=t.id,
                    avatar_color=colors[k], is_online=random.random() > 0.5
                ))

        db.session.add(Message(
            content=f"🎉 {pd['name']} proje odası oluşturuldu! {team_pairs[i][0]} ve {team_pairs[i][1]} hazır.",
            project_id=p.id, sender_name='Sistem', msg_type='system'
        ))

    db.session.commit()
    print("✅ Seed data yüklendi: 6 proje, 12 takım, 120 üye")


# ═══════════════════════════════════════════
if __name__ == '__main__':
    os.makedirs(os.path.join(basedir, 'instance'), exist_ok=True)
    with app.app_context():
        db.create_all()
        seed_data()
    print("\n🚀 Emare Ekip Yönetici — http://localhost:5050\n")
    app.run(debug=True, host='0.0.0.0', port=5050)
