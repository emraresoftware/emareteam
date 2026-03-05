/* ═══════════════════════════════════════════
   Emare Ekip Yönetici — Frontend SPA
   ═══════════════════════════════════════════ */

const App = {
    state: {
        projects: [],
        currentProject: null,
        messages: [],
        tasks: [],
        teams: [],
        allMembers: [],
        view: 'chat',
        sidebarOpen: false,
        teamPanelOpen: false,
        pollTimer: null,
        lastMsgId: 0,
        taskFilter: 'all',
        stats: null,
    },

    // ═══════════════════════════════════════════
    // INIT
    // ═══════════════════════════════════════════
    async init() {
        this.addToastContainer();
        await this.loadProjects();
        this.renderSidebar();
        this.renderWelcome();

        // Auto-select first project if on desktop
        if (window.innerWidth > 768 && this.state.projects.length > 0) {
            this.selectProject(this.state.projects[0].id);
        }
    },

    // ═══════════════════════════════════════════
    // API
    // ═══════════════════════════════════════════
    async api(method, url, body = null) {
        const opts = { method, headers: { 'Content-Type': 'application/json' } };
        if (body) opts.body = JSON.stringify(body);
        const res = await fetch(url, opts);
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
    },

    // ═══════════════════════════════════════════
    // DATA LOADING
    // ═══════════════════════════════════════════
    async loadProjects() {
        this.state.projects = await this.api('GET', '/api/projects');
    },

    async loadFeed(projectId) {
        const msgs = await this.api('GET', `/api/projects/${projectId}/feed?after=${this.state.lastMsgId}`);
        if (msgs.length > 0) {
            this.state.messages.push(...msgs);
            this.state.lastMsgId = msgs[msgs.length - 1].id;
            return true;
        }
        return false;
    },

    async loadTeams(projectId) {
        const teams = await this.api('GET', `/api/projects/${projectId}/teams`);
        this.state.teams = teams;
        this.state.allMembers = teams.flatMap(t => t.members);
    },

    async loadTasks(projectId) {
        this.state.tasks = await this.api('GET', `/api/projects/${projectId}/tasks`);
    },

    async loadStats() {
        this.state.stats = await this.api('GET', '/api/stats');
    },

    // ═══════════════════════════════════════════
    // NAVIGATION
    // ═══════════════════════════════════════════
    toggleSidebar() {
        this.state.sidebarOpen = !this.state.sidebarOpen;
        document.getElementById('sidebar').classList.toggle('open', this.state.sidebarOpen);
        document.getElementById('overlay').classList.toggle('show', this.state.sidebarOpen);
    },

    closeSidebar() {
        this.state.sidebarOpen = false;
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('overlay').classList.remove('show');
    },

    toggleTeamPanel() {
        this.state.teamPanelOpen = !this.state.teamPanelOpen;
        document.getElementById('team-panel').classList.toggle('open', this.state.teamPanelOpen);
        if (this.state.teamPanelOpen && this.state.currentProject) {
            this.renderTeamPanel();
        }
    },

    showView(view) {
        if (!this.state.currentProject && view !== 'pano') {
            this.toast('Önce bir proje seçin');
            return;
        }
        this.state.view = view;

        // Update bottom nav active
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });

        // Show/hide chat input
        const chatInput = document.getElementById('chat-input-area');
        if (view === 'chat') {
            chatInput.classList.remove('hidden');
        } else {
            chatInput.classList.add('hidden');
        }

        this.renderContent();
    },

    async selectProject(id) {
        const project = this.state.projects.find(p => p.id === id);
        if (!project) return;

        this.state.currentProject = project;
        this.state.messages = [];
        this.state.lastMsgId = 0;
        this.state.tasks = [];
        this.state.teams = [];
        this.state.allMembers = [];
        this.state.view = 'chat';

        this.closeSidebar();
        this.renderSidebar();
        this.updateTopbar();

        // Load data in parallel
        await Promise.all([
            this.loadFeed(id),
            this.loadTeams(id),
            this.loadTasks(id),
        ]);

        // Update bottom nav
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === 'chat');
        });

        document.getElementById('chat-input-area').classList.remove('hidden');
        this.renderContent();
        this.renderTeamPanel();
        this.startPolling();
    },

    // ═══════════════════════════════════════════
    // RENDERING — Sidebar
    // ═══════════════════════════════════════════
    renderSidebar() {
        const el = document.getElementById('project-list');
        const current = this.state.currentProject;
        el.innerHTML = `
            <div class="sidebar-section-label">
                <span>Projeler</span>
                <button class="btn-add-project" onclick="event.stopPropagation();ProjectMgr.showCreate()" title="Yeni Proje">＋</button>
            </div>
        ` + this.state.projects.map(p => `
            <div class="project-item ${current && current.id === p.id ? 'active' : ''}"
                 onclick="App.selectProject(${p.id})">
                <div class="p-icon" style="background:${p.color}20;color:${p.color}">${p.icon}</div>
                <div class="p-info">
                    <div class="p-name">${this.esc(p.name)}</div>
                    <div class="p-meta">${p.member_count} üye · ${p.active_tasks} aktif görev</div>
                </div>
                ${p.active_tasks > 0 ? `<div class="p-badge">${p.active_tasks}</div>` : ''}
                <button class="p-menu-btn" onclick="event.stopPropagation();ProjectMgr.showEdit(${p.id})" title="Düzenle">⚙️</button>
            </div>
        `).join('');
    },

    // ═══════════════════════════════════════════
    // RENDERING — Topbar
    // ═══════════════════════════════════════════
    updateTopbar() {
        const p = this.state.currentProject;
        if (!p) return;
        document.getElementById('topbar-title').textContent = `${p.icon} ${p.name}`;
        document.getElementById('topbar-sub').textContent = `${p.member_count} üye · ${p.team_count} takım`;
    },

    // ═══════════════════════════════════════════
    // RENDERING — Content Router
    // ═══════════════════════════════════════════
    renderContent() {
        const view = this.state.view;
        if (view === 'chat')          this.renderChat();
        else if (view === 'dosyalar') Files.render();
        else if (view === 'gorevler') this.renderTasks();
        else if (view === 'ekip')     this.renderTeamView();
        else if (view === 'pano')     this.renderDashboard();
    },

    // ═══════════════════════════════════════════
    // RENDERING — Welcome
    // ═══════════════════════════════════════════
    renderWelcome() {
        document.getElementById('content').innerHTML = `
            <div class="welcome">
                <div class="welcome-icon">🏢</div>
                <h2>Emare Ekip Yönetici</h2>
                <p>Sol menüden bir proje seçerek başlayın. Her projede 2 takım ve 10'ar kişilik ekiplerle çalışabilirsiniz.</p>
            </div>
        `;
        document.getElementById('chat-input-area').classList.add('hidden');
        document.getElementById('topbar-title').textContent = 'Emare Ekip Yönetici';
        document.getElementById('topbar-sub').textContent = `${this.state.projects.length} proje · ${this.state.projects.reduce((s,p) => s+p.member_count, 0)} üye`;
    },

    // ═══════════════════════════════════════════
    // RENDERING — Chat
    // ═══════════════════════════════════════════
    renderChat() {
        const el = document.getElementById('content');
        if (this.state.messages.length === 0) {
            el.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">💬</div>
                    <div class="empty-text">Henüz mesaj yok. İlk mesajı gönderin!</div>
                </div>`;
            return;
        }

        el.innerHTML = `<div class="chat-feed" id="chat-feed">
            ${this.state.messages.map(m => this.renderMessage(m)).join('')}
        </div>`;

        this.scrollChatToBottom();
    },

    renderMessage(m) {
        const time = this.timeAgo(m.created_at);

        if (m.msg_type === 'system') {
            return `<div class="msg-bubble msg-system">${this.esc(m.content)}</div>`;
        }

        if (m.msg_type === 'status') {
            return `<div class="msg-bubble msg-status">${this.esc(m.content)} · <small>${time}</small></div>`;
        }

        if (m.msg_type === 'task' && m.task) {
            const t = m.task;
            const statusClass = this.statusColor(t.status);
            const statusLabel = this.statusLabel(t.status);
            return `
                <div class="msg-bubble msg-task-card" onclick="App.openEditTask(${t.id})">
                    <div class="tc-title">${this.esc(t.title)}</div>
                    <div class="tc-meta">
                        <span class="tc-status" style="background:${statusClass}20;color:${statusClass}">${statusLabel}</span>
                        <span>👤 ${this.esc(t.assignee_name || 'Atanmadı')}</span>
                        <span>${this.priorityEmoji(t.priority)} ${this.priorityLabel(t.priority)}</span>
                    </div>
                    <div class="msg-time">${time}</div>
                </div>`;
        }

        // Normal text message
        return `
            <div class="msg-bubble msg-mine">
                <div class="msg-sender">${this.esc(m.sender_name)}</div>
                ${this.formatContent(m.content)}
                <div class="msg-time">${time}</div>
            </div>`;
    },

    scrollChatToBottom() {
        const feed = document.getElementById('chat-feed');
        if (feed) {
            const content = document.getElementById('content');
            content.scrollTop = content.scrollHeight;
        }
    },

    // ═══════════════════════════════════════════
    // RENDERING — Tasks (Kanban)
    // ═══════════════════════════════════════════
    renderTasks() {
        const el = document.getElementById('content');
        const tasks = this.state.tasks;
        const p = this.state.currentProject;

        const cols = [
            { key: 'yeni',       label: '🆕 Yeni',         color: '#6c757d' },
            { key: 'devam',      label: '🔄 Devam Ediyor', color: '#3498DB' },
            { key: 'inceleme',   label: '🔍 İnceleme',     color: '#F39C12' },
            { key: 'tamamlandi', label: '✅ Tamamlandı',    color: '#27AE60' },
        ];

        el.innerHTML = `
            <div class="tasks-view">
                <div class="tasks-header">
                    <h3>📋 Görevler — ${p.name}</h3>
                    <button class="btn-primary" style="width:auto;padding:8px 16px" onclick="App.showTaskModal()">+ Yeni Görev</button>
                </div>
                <div class="task-columns">
                    ${cols.map(col => {
                        const colTasks = tasks.filter(t => t.status === col.key);
                        return `
                            <div class="task-column">
                                <div class="task-col-header">
                                    <span>${col.label}</span>
                                    <span class="task-col-count">${colTasks.length}</span>
                                </div>
                                ${colTasks.length === 0 ? '<div class="empty-state" style="min-height:80px"><div class="empty-text">Görev yok</div></div>' : ''}
                                ${colTasks.map(t => this.renderTaskCard(t)).join('')}
                            </div>`;
                    }).join('')}
                </div>
            </div>`;
    },

    renderTaskCard(t) {
        const nextStatus = this.nextStatus(t.status);
        return `
            <div class="task-card pri-${t.priority}" onclick="App.openEditTask(${t.id})">
                <div class="tc-top">
                    <h4>${this.esc(t.title)}</h4>
                    <span class="pri-badge">${this.priorityEmoji(t.priority)} ${this.priorityLabel(t.priority)}</span>
                </div>
                ${t.description ? `<div style="font-size:12px;color:#666;margin-top:4px">${this.esc(t.description).substring(0, 80)}</div>` : ''}
                <div class="tc-bottom">
                    ${t.assignee_name ? `
                        <span class="tc-assignee">
                            <span class="mini-avatar" style="background:${t.assignee_color || '#999'}">${t.assignee_name.charAt(0)}</span>
                            ${this.esc(t.assignee_name.split(' ')[0])}
                        </span>` : '<span style="color:#999">Atanmadı</span>'}
                    ${t.deadline ? `<span class="tc-deadline">📅 ${this.formatDate(t.deadline)}</span>` : ''}
                    ${nextStatus ? `
                        <span class="status-actions">
                            <button onclick="event.stopPropagation();App.quickStatus(${t.id},'${nextStatus.key}')" title="${nextStatus.label}">
                                ${nextStatus.emoji} →
                            </button>
                        </span>` : ''}
                </div>
            </div>`;
    },

    // ═══════════════════════════════════════════
    // RENDERING — Team View (full page)
    // ═══════════════════════════════════════════
    renderTeamView() {
        const el = document.getElementById('content');
        const p = this.state.currentProject;
        const teams = this.state.teams;

        el.innerHTML = `
            <div class="team-view">
                <h3>👥 Ekip — ${p.name}</h3>
                <div class="team-grid">
                    ${teams.map(team => `
                        <div class="team-block">
                            <div class="team-block-header" style="background:${p.color}">
                                ${this.esc(team.name)}
                                <span style="font-size:12px;opacity:0.8">${team.members.length} kişi</span>
                            </div>
                            <div class="team-block-body">
                                ${team.members.map(m => {
                                    const memberTasks = this.state.tasks.filter(t => t.assigned_to === m.id && t.status !== 'tamamlandi');
                                    return `
                                    <div class="team-member-row">
                                        <div class="member-avatar" style="background:${m.avatar_color}">
                                            ${m.name.charAt(0)}
                                            ${m.is_online ? '<span class="online-dot"></span>' : ''}
                                        </div>
                                        <div class="member-info">
                                            <div class="member-name">${this.esc(m.name)}</div>
                                            <div class="member-role">${this.esc(m.role)}</div>
                                        </div>
                                        <div class="member-tasks">
                                            ${memberTasks.length > 0 ? `<span>📋 ${memberTasks.length}</span>` : '<span style="color:#ccc">—</span>'}
                                        </div>
                                        <div style="display:flex;gap:4px">
                                            <button onclick="App.editMember(${m.id})" style="background:none;border:none;cursor:pointer;font-size:14px" title="Düzenle">✏️</button>
                                            <button onclick="App.removeMember(${m.id})" style="background:none;border:none;cursor:pointer;font-size:14px" title="Çıkar">🗑️</button>
                                        </div>
                                    </div>`;
                                }).join('')}
                                <button class="btn-add-team-member" onclick="App.showAddMember(${team.id})">
                                    + Üye Ekle
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>`;
    },

    // ═══════════════════════════════════════════
    // RENDERING — Team Panel (right sidebar)
    // ═══════════════════════════════════════════
    renderTeamPanel() {
        const el = document.getElementById('team-panel');
        if (!this.state.currentProject || this.state.teams.length === 0) {
            el.innerHTML = '';
            return;
        }

        el.innerHTML = `
            <div class="team-panel-inner">
                <div class="tp-header">
                    <h3>👥 Ekip</h3>
                    <button onclick="App.toggleTeamPanel()" class="btn-close" style="width:28px;height:28px;font-size:14px">✕</button>
                </div>
                ${this.state.teams.map(team => `
                    <div class="tp-team">
                        <div class="tp-team-name">
                            ${this.esc(team.name)} (${team.members.length})
                            <button class="btn-add-member" onclick="App.showAddMember(${team.id})" title="Üye ekle">+</button>
                        </div>
                        ${team.members.map(m => `
                            <div class="member-card" onclick="App.editMember(${m.id})">
                                <div class="member-avatar" style="background:${m.avatar_color}">
                                    ${m.name.charAt(0)}
                                    ${m.is_online ? '<span class="online-dot"></span>' : ''}
                                </div>
                                <div class="member-info">
                                    <div class="member-name">${this.esc(m.name)}</div>
                                    <div class="member-role">${this.esc(m.role)}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `).join('')}
            </div>`;
    },

    // ═══════════════════════════════════════════
    // RENDERING — Dashboard
    // ═══════════════════════════════════════════
    async renderDashboard() {
        const el = document.getElementById('content');
        el.innerHTML = '<div class="dashboard"><div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-text">Yükleniyor...</div></div></div>';

        await this.loadStats();
        await this.loadProjects();
        const s = this.state.stats;
        if (!s) return;

        const barColors = {
            yeni: '#6c757d', devam: '#3498DB',
            inceleme: '#F39C12', tamamlandi: '#27AE60'
        };

        el.innerHTML = `
            <div class="dashboard">
                <h2>📊 Genel Pano</h2>
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-num" style="color:var(--primary)">${s.total_tasks}</div>
                        <div class="stat-label">Toplam Görev</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-num" style="color:var(--warning)">${s.active_tasks}</div>
                        <div class="stat-label">Aktif Görev</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-num" style="color:var(--success)">${s.completed_tasks}</div>
                        <div class="stat-label">Tamamlanan</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-num" style="color:var(--info)">${s.total_members}</div>
                        <div class="stat-label">Toplam Üye</div>
                    </div>
                </div>

                <h3 style="margin-bottom:12px">Proje Bazlı Durum</h3>
                <div class="project-stats-grid">
                    ${s.project_stats.map(ps => {
                        const p = ps.project;
                        const total = ps.yeni + ps.devam + ps.inceleme + ps.tamamlandi;
                        const maxVal = Math.max(ps.yeni, ps.devam, ps.inceleme, ps.tamamlandi, 1);
                        return `
                            <div class="project-stat-card" style="cursor:pointer" onclick="App.selectProject(${p.id})">
                                <div class="psc-header">
                                    <div class="psc-icon" style="background:${p.color}20;color:${p.color}">${p.icon}</div>
                                    <div>
                                        <div class="psc-name">${this.esc(p.name)}</div>
                                        <div style="font-size:11px;color:#999">${p.member_count} üye · ${total} görev</div>
                                    </div>
                                </div>
                                <div class="psc-bars">
                                    ${[
                                        { label: 'Yeni', val: ps.yeni, color: barColors.yeni },
                                        { label: 'Devam', val: ps.devam, color: barColors.devam },
                                        { label: 'İnceleme', val: ps.inceleme, color: barColors.inceleme },
                                        { label: 'Tamamlandı', val: ps.tamamlandi, color: barColors.tamamlandi },
                                    ].map(b => `
                                        <div class="psc-bar-row">
                                            <span class="bar-label">${b.label}</span>
                                            <div class="bar-track">
                                                <div class="bar-fill" style="width:${total > 0 ? (b.val/maxVal*100) : 0}%;background:${b.color}"></div>
                                            </div>
                                            <span class="bar-num">${b.val}</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>`;
                    }).join('')}
                </div>
            </div>`;

        document.getElementById('topbar-title').textContent = '📊 Genel Pano';
        document.getElementById('topbar-sub').textContent = `${s.total_tasks} görev · ${s.total_members} üye`;
        document.getElementById('chat-input-area').classList.add('hidden');
    },

    // ═══════════════════════════════════════════
    // ACTIONS — Messages
    // ═══════════════════════════════════════════
    async sendMessage() {
        const input = document.getElementById('chat-input');
        const content = input.value.trim();
        if (!content || !this.state.currentProject) return;

        input.value = '';
        await this.api('POST', `/api/projects/${this.state.currentProject.id}/messages`, {
            content, sender_name: 'Emre', msg_type: 'text'
        });

        await this.loadFeed(this.state.currentProject.id);
        if (this.state.view === 'chat') {
            this.renderChat();
        }
    },

    // ═══════════════════════════════════════════
    // ACTIONS — Tasks
    // ═══════════════════════════════════════════
    showTaskModal() {
        if (!this.state.currentProject) return;
        this.populateAssigneeSelect('task-assignee');
        document.getElementById('task-modal').classList.remove('hidden');
        document.getElementById('task-title').focus();
    },

    hideTaskModal() {
        document.getElementById('task-modal').classList.add('hidden');
        document.getElementById('task-title').value = '';
        document.getElementById('task-desc').value = '';
        document.getElementById('task-deadline').value = '';
        document.getElementById('task-priority').value = 'orta';
    },

    async createTask(e) {
        e.preventDefault();
        const pid = this.state.currentProject.id;
        const data = {
            title: document.getElementById('task-title').value,
            description: document.getElementById('task-desc').value,
            priority: document.getElementById('task-priority').value,
            assigned_to: document.getElementById('task-assignee').value || null,
            deadline: document.getElementById('task-deadline').value || null,
        };

        await this.api('POST', `/api/projects/${pid}/tasks`, data);
        this.hideTaskModal();

        await Promise.all([
            this.loadFeed(pid),
            this.loadTasks(pid),
            this.loadProjects(),
        ]);

        this.renderSidebar();
        this.renderContent();
        this.toast('✅ Görev oluşturuldu');
    },

    async quickStatus(taskId, status) {
        await this.api('PATCH', `/api/tasks/${taskId}`, { status });
        const pid = this.state.currentProject.id;
        await Promise.all([
            this.loadFeed(pid),
            this.loadTasks(pid),
            this.loadProjects(),
        ]);
        this.renderSidebar();
        this.renderContent();
    },

    openEditTask(taskId) {
        const task = this.state.tasks.find(t => t.id === taskId);
        if (!task) return;

        this.populateAssigneeSelect('edit-task-assignee');
        document.getElementById('edit-task-id').value = task.id;
        document.getElementById('edit-task-title').value = task.title;
        document.getElementById('edit-task-desc').value = task.description || '';
        document.getElementById('edit-task-status').value = task.status;
        document.getElementById('edit-task-priority').value = task.priority;
        document.getElementById('edit-task-assignee').value = task.assigned_to || '';
        document.getElementById('edit-task-deadline').value = task.deadline ? task.deadline.split('T')[0] : '';
        document.getElementById('task-edit-modal').classList.remove('hidden');
    },

    hideEditTaskModal() {
        document.getElementById('task-edit-modal').classList.add('hidden');
    },

    async saveEditTask(e) {
        e.preventDefault();
        const tid = document.getElementById('edit-task-id').value;
        const data = {
            title: document.getElementById('edit-task-title').value,
            description: document.getElementById('edit-task-desc').value,
            status: document.getElementById('edit-task-status').value,
            priority: document.getElementById('edit-task-priority').value,
            assigned_to: document.getElementById('edit-task-assignee').value || null,
            deadline: document.getElementById('edit-task-deadline').value || null,
        };

        await this.api('PATCH', `/api/tasks/${tid}`, data);
        this.hideEditTaskModal();

        const pid = this.state.currentProject.id;
        await Promise.all([
            this.loadFeed(pid),
            this.loadTasks(pid),
            this.loadProjects(),
        ]);
        this.renderSidebar();
        this.renderContent();
        this.toast('✅ Görev güncellendi');
    },

    async deleteTaskFromEdit() {
        const tid = document.getElementById('edit-task-id').value;
        if (!confirm('Bu görevi silmek istediğinize emin misiniz?')) return;

        await this.api('DELETE', `/api/tasks/${tid}`);
        this.hideEditTaskModal();

        const pid = this.state.currentProject.id;
        await Promise.all([
            this.loadFeed(pid),
            this.loadTasks(pid),
            this.loadProjects(),
        ]);
        this.renderSidebar();
        this.renderContent();
        this.toast('🗑️ Görev silindi');
    },

    // ═══════════════════════════════════════════
    // ACTIONS — Members
    // ═══════════════════════════════════════════
    showAddMember(teamId) {
        document.getElementById('member-modal-title').textContent = '👤 Üye Ekle';
        document.getElementById('member-id').value = '';
        document.getElementById('member-team-id').value = teamId;
        document.getElementById('member-name').value = '';
        document.getElementById('member-role').value = 'Full-Stack Geliştirici';
        document.getElementById('member-modal').classList.remove('hidden');
        document.getElementById('member-name').focus();
    },

    editMember(memberId) {
        const member = this.state.allMembers.find(m => m.id === memberId);
        if (!member) return;

        document.getElementById('member-modal-title').textContent = '✏️ Üye Düzenle';
        document.getElementById('member-id').value = member.id;
        document.getElementById('member-team-id').value = member.team_id;
        document.getElementById('member-name').value = member.name;
        document.getElementById('member-role').value = member.role;
        document.getElementById('member-modal').classList.remove('hidden');
    },

    hideMemberModal() {
        document.getElementById('member-modal').classList.add('hidden');
    },

    async saveMember(e) {
        e.preventDefault();
        const memberId = document.getElementById('member-id').value;
        const teamId = document.getElementById('member-team-id').value;
        const data = {
            name: document.getElementById('member-name').value,
            role: document.getElementById('member-role').value,
        };

        if (memberId) {
            await this.api('PATCH', `/api/members/${memberId}`, data);
            this.toast('✅ Üye güncellendi');
        } else {
            await this.api('POST', `/api/teams/${teamId}/members`, data);
            this.toast('👋 Üye eklendi');
        }

        this.hideMemberModal();
        const pid = this.state.currentProject.id;
        await Promise.all([this.loadTeams(pid), this.loadProjects()]);
        this.renderSidebar();
        this.renderContent();
        this.renderTeamPanel();
    },

    async removeMember(memberId) {
        const member = this.state.allMembers.find(m => m.id === memberId);
        if (!member) return;
        if (!confirm(`${member.name} ekipten çıkarılsın mı?`)) return;

        await this.api('DELETE', `/api/members/${memberId}`);
        const pid = this.state.currentProject.id;
        await Promise.all([this.loadTeams(pid), this.loadTasks(pid), this.loadProjects()]);
        this.renderSidebar();
        this.renderContent();
        this.renderTeamPanel();
        this.toast('🗑️ Üye çıkarıldı');
    },

    // ═══════════════════════════════════════════
    // POLLING
    // ═══════════════════════════════════════════
    startPolling() {
        this.stopPolling();
        this.state.pollTimer = setInterval(() => this.poll(), 5000);
    },

    stopPolling() {
        if (this.state.pollTimer) {
            clearInterval(this.state.pollTimer);
            this.state.pollTimer = null;
        }
    },

    async poll() {
        if (!this.state.currentProject) return;
        const hasNew = await this.loadFeed(this.state.currentProject.id);
        if (hasNew && this.state.view === 'chat') {
            this.renderChat();
        }
    },

    // ═══════════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════════
    populateAssigneeSelect(selectId) {
        const sel = document.getElementById(selectId);
        const val = sel.value;
        sel.innerHTML = '<option value="">Seçiniz...</option>';
        this.state.teams.forEach(team => {
            const group = document.createElement('optgroup');
            group.label = team.name;
            team.members.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m.id;
                opt.textContent = `${m.name} (${m.role})`;
                group.appendChild(opt);
            });
            sel.appendChild(group);
        });
        if (val) sel.value = val;
    },

    nextStatus(current) {
        const flow = {
            'yeni':    { key: 'devam',      emoji: '🔄', label: 'Başlat' },
            'devam':   { key: 'inceleme',   emoji: '🔍', label: 'İncelemeye al' },
            'inceleme':{ key: 'tamamlandi', emoji: '✅', label: 'Tamamla' },
        };
        return flow[current] || null;
    },

    statusColor(s) {
        const map = { yeni: '#6c757d', devam: '#3498DB', inceleme: '#F39C12', tamamlandi: '#27AE60' };
        return map[s] || '#999';
    },

    statusLabel(s) {
        const map = { yeni: '🆕 Yeni', devam: '🔄 Devam', inceleme: '🔍 İnceleme', tamamlandi: '✅ Tamamlandı' };
        return map[s] || s;
    },

    priorityEmoji(p) {
        return { dusuk: '🟢', orta: '🟡', yuksek: '🟠', acil: '🔴' }[p] || '🟡';
    },

    priorityLabel(p) {
        return { dusuk: 'Düşük', orta: 'Orta', yuksek: 'Yüksek', acil: 'Acil' }[p] || p;
    },

    timeAgo(dateStr) {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = Math.floor((now - date) / 1000);
        if (diff < 60) return 'Az önce';
        if (diff < 3600) return `${Math.floor(diff/60)}dk`;
        if (diff < 86400) return `${Math.floor(diff/3600)}sa`;
        return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
    },

    formatDate(dateStr) {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
    },

    formatContent(text) {
        return `<div>${this.esc(text).replace(/\n/g, '<br>')}</div>`;
    },

    esc(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    // Toast notifications
    addToastContainer() {
        if (!document.querySelector('.toast-container')) {
            const c = document.createElement('div');
            c.className = 'toast-container';
            document.body.appendChild(c);
        }
    },

    toast(message) {
        const container = document.querySelector('.toast-container');
        const t = document.createElement('div');
        t.className = 'toast';
        t.textContent = message;
        container.appendChild(t);
        setTimeout(() => t.remove(), 3000);
    },
};

/* ═══════════════════════════════════════════
   PROJECT MANAGER — Proje CRUD
   ═══════════════════════════════════════════ */

const ProjectMgr = {
    _selectedIcon: '📦',
    _selectedColor: '#6366f1',

    showCreate() {
        document.getElementById('project-modal-title').textContent = '📦 Yeni Proje';
        document.getElementById('proj-edit-id').value = '';
        document.getElementById('proj-name').value = '';
        document.getElementById('proj-code').value = '';
        document.getElementById('proj-path').value = '';
        document.getElementById('proj-desc').value = '';
        document.getElementById('proj-teams').value = 'Backend Takımı, Frontend Takımı';
        document.getElementById('proj-teams-group').classList.remove('hidden');
        document.getElementById('proj-delete-btn').classList.add('hidden');
        this._selectedIcon = '📦';
        this._selectedColor = '#6366f1';
        this._updatePickers();
        document.getElementById('project-modal').classList.remove('hidden');
        document.getElementById('proj-name').focus();
    },

    showEdit(pid) {
        const p = App.state.projects.find(pr => pr.id === pid);
        if (!p) return;
        document.getElementById('project-modal-title').textContent = '⚙️ Proje Düzenle';
        document.getElementById('proj-edit-id').value = p.id;
        document.getElementById('proj-name').value = p.name;
        document.getElementById('proj-code').value = p.code || '';
        document.getElementById('proj-path').value = p.path || '';
        document.getElementById('proj-desc').value = p.description || '';
        document.getElementById('proj-teams-group').classList.add('hidden');
        document.getElementById('proj-delete-btn').classList.remove('hidden');
        this._selectedIcon = p.icon || '📦';
        this._selectedColor = p.color || '#6366f1';
        this._updatePickers();
        document.getElementById('project-modal').classList.remove('hidden');
    },

    closeModal() {
        document.getElementById('project-modal').classList.add('hidden');
    },

    pickIcon(el) {
        this._selectedIcon = el.dataset.icon;
        document.querySelectorAll('#proj-icon-picker .icon-option').forEach(o => o.classList.remove('selected'));
        el.classList.add('selected');
    },

    pickColor(el) {
        this._selectedColor = el.dataset.color;
        document.querySelectorAll('#proj-color-picker .color-swatch').forEach(o => o.classList.remove('selected'));
        el.classList.add('selected');
    },

    _updatePickers() {
        document.querySelectorAll('#proj-icon-picker .icon-option').forEach(o => {
            o.classList.toggle('selected', o.dataset.icon === this._selectedIcon);
        });
        document.querySelectorAll('#proj-color-picker .color-swatch').forEach(o => {
            o.classList.toggle('selected', o.dataset.color === this._selectedColor);
        });
    },

    async save(e) {
        e.preventDefault();
        const editId = document.getElementById('proj-edit-id').value;
        const name = document.getElementById('proj-name').value.trim();
        const code = document.getElementById('proj-code').value.trim().toUpperCase() || name.substring(0,3).toUpperCase();
        const path = document.getElementById('proj-path').value.trim();
        const description = document.getElementById('proj-desc').value.trim();

        const payload = {
            name, code, path, description,
            icon: this._selectedIcon,
            color: this._selectedColor,
        };

        try {
            if (editId) {
                // Update
                await App.api('PATCH', `/api/projects/${editId}`, payload);
                App.toast('✅ Proje güncellendi');
            } else {
                // Create
                const teamsRaw = document.getElementById('proj-teams').value;
                payload.teams = teamsRaw.split(',').map(t => t.trim()).filter(Boolean);
                await App.api('POST', '/api/projects', payload);
                App.toast('🎉 Proje oluşturuldu!');
            }
            this.closeModal();
            await App.loadProjects();
            App.renderSidebar();

            // If edited current project, refresh topbar
            if (editId && App.state.currentProject && App.state.currentProject.id == editId) {
                App.state.currentProject = App.state.projects.find(p => p.id == editId);
                App.updateTopbar();
            }
        } catch (err) {
            App.toast('⚠️ ' + (err.message || 'Hata oluştu'));
        }
    },

    async deleteProject() {
        const editId = document.getElementById('proj-edit-id').value;
        if (!editId) return;
        const p = App.state.projects.find(pr => pr.id == editId);
        if (!p) return;
        if (!confirm(`"${p.name}" projesi ve tüm verileri silinecek. Emin misiniz?`)) return;

        try {
            await App.api('DELETE', `/api/projects/${editId}`);
            this.closeModal();
            App.toast('🗑️ Proje silindi');

            // If deleted current project, go to welcome
            if (App.state.currentProject && App.state.currentProject.id == editId) {
                App.state.currentProject = null;
                clearInterval(App.state.pollTimer);
            }
            await App.loadProjects();
            App.renderSidebar();
            if (!App.state.currentProject) {
                App.renderWelcome();
            }
        } catch (err) {
            App.toast('⚠️ Silme hatası');
        }
    },
};


/* ═══════════════════════════════════════════
   FILES MODULE — Dosya Yöneticisi
   ═══════════════════════════════════════════ */

const Files = {
    state: {
        currentPath: '',
        items: [],
        openFile: null,
        editing: false,
        searchQuery: '',
    },

    // ═══════════════════════════════════════════
    // RENDERING
    // ═══════════════════════════════════════════
    async render() {
        const el = document.getElementById('content');
        const p = App.state.currentProject;
        if (!p) return;

        el.innerHTML = `
            <div class="files-view">
                <div class="files-header">
                    <h3>📁 Dosyalar — ${App.esc(p.name)}</h3>
                    <div class="files-toolbar">
                        <button class="btn-sm" onclick="Files.showNewFileModal()">📄 Yeni Dosya</button>
                        <button class="btn-sm" onclick="Files.showNewFolderModal()">📁 Yeni Klasör</button>
                        <button class="btn-sm" onclick="Files.refresh()">🔄 Yenile</button>
                    </div>
                </div>
                <div class="file-search-bar">
                    <input type="text" id="file-search-input" placeholder="Dosya ara..."
                           value="${App.esc(this.state.searchQuery)}"
                           oninput="Files.onSearch(this.value)"
                           onkeydown="if(event.key==='Enter')Files.doSearch()">
                </div>
                <div id="file-breadcrumb" class="breadcrumb"></div>
                <div id="file-list" class="file-list">
                    <div class="empty-state"><div class="empty-icon">⏳</div><div class="empty-text">Yükleniyor...</div></div>
                </div>
            </div>`;

        await this.loadDir(this.state.currentPath);
    },

    async loadDir(path) {
        const p = App.state.currentProject;
        this.state.currentPath = path;
        this.state.searchQuery = '';

        try {
            const data = await App.api('GET', `/api/projects/${p.id}/files?path=${encodeURIComponent(path)}`);
            this.state.items = data.items;
            this.renderBreadcrumb(path);
            this.renderFileList(data.items);
        } catch (e) {
            document.getElementById('file-list').innerHTML =
                `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-text">Dizin yüklenemedi</div></div>`;
        }
    },

    renderBreadcrumb(path) {
        const el = document.getElementById('file-breadcrumb');
        if (!el) return;
        const p = App.state.currentProject;
        let html = `<a href="#" onclick="Files.loadDir('');return false">🏠 ${App.esc(p.name)}</a>`;

        if (path) {
            const parts = path.split('/');
            let acc = '';
            for (let i = 0; i < parts.length; i++) {
                acc += (i > 0 ? '/' : '') + parts[i];
                const isLast = i === parts.length - 1;
                html += `<span class="sep">/</span>`;
                if (isLast) {
                    html += `<span class="current">${App.esc(parts[i])}</span>`;
                } else {
                    html += `<a href="#" onclick="Files.loadDir('${acc}');return false">${App.esc(parts[i])}</a>`;
                }
            }
        }
        el.innerHTML = html;
    },

    renderFileList(items) {
        const el = document.getElementById('file-list');
        if (!el) return;

        if (items.length === 0) {
            el.innerHTML = `<div class="empty-state"><div class="empty-icon">📂</div><div class="empty-text">Bu klasör boş</div></div>`;
            return;
        }

        // Back button if in subfolder
        let html = '';
        if (this.state.currentPath) {
            const parent = this.state.currentPath.split('/').slice(0, -1).join('/');
            html += `
                <div class="file-row" onclick="Files.loadDir('${parent}')">
                    <div class="file-icon dir">⬆️</div>
                    <div class="file-info"><div class="file-name">.. (üst klasör)</div></div>
                </div>`;
        }

        html += items.map(f => {
            const icon = this.getIcon(f);
            const iconClass = f.is_dir ? 'dir' : `file-${(f.ext || '').replace('.', '') || 'other'}`;
            if (f.is_dir) {
                return `
                    <div class="file-row" onclick="Files.loadDir('${App.esc(f.path)}')">
                        <div class="file-icon ${iconClass}">${icon}</div>
                        <div class="file-info">
                            <div class="file-name">${App.esc(f.name)}</div>
                        </div>
                        <div class="file-actions">
                            <button onclick="event.stopPropagation();Files.shareItem('${App.esc(f.path)}','${App.esc(f.name)}')" title="Paylaş">📤</button>
                            <button onclick="event.stopPropagation();Files.deleteItem('${App.esc(f.path)}','${App.esc(f.name)}')" title="Sil">🗑️</button>
                        </div>
                    </div>`;
            } else {
                const size = this.formatSize(f.size);
                const mod = f.modified ? App.timeAgo(f.modified) : '';
                return `
                    <div class="file-row" onclick="Files.openFile('${App.esc(f.path)}')">
                        <div class="file-icon ${iconClass}">${icon}</div>
                        <div class="file-info">
                            <div class="file-name">${App.esc(f.name)}</div>
                            <div class="file-meta">
                                <span>${size}</span>
                                <span>${mod}</span>
                            </div>
                        </div>
                        <div class="file-actions">
                            <button onclick="event.stopPropagation();Files.downloadItem('${App.esc(f.path)}')" title="İndir">⬇️</button>
                            <button onclick="event.stopPropagation();Files.shareItem('${App.esc(f.path)}','${App.esc(f.name)}')" title="Paylaş">📤</button>
                            <button onclick="event.stopPropagation();Files.deleteItem('${App.esc(f.path)}','${App.esc(f.name)}')" title="Sil">🗑️</button>
                        </div>
                    </div>`;
            }
        }).join('');

        el.innerHTML = html;
    },

    // ═══════════════════════════════════════════
    // FILE OPEN / EDIT
    // ═══════════════════════════════════════════
    async openFile(path) {
        const p = App.state.currentProject;
        try {
            const data = await App.api('GET', `/api/projects/${p.id}/file?path=${encodeURIComponent(path)}`);
            this.state.openFile = data;
            this.state.editing = false;

            document.getElementById('file-modal-title').textContent = `📄 ${data.name}`;
            document.getElementById('file-info-bar').innerHTML = `
                <span>📏 ${this.formatSize(data.size)}</span>
                <span>📝 ${data.line_count || '—'} satır</span>
                <span>🕐 ${data.modified ? new Date(data.modified).toLocaleString('tr-TR') : '—'}</span>
                <span>📂 ${App.esc(data.path)}</span>
            `;

            const view = document.getElementById('file-content-view');
            const edit = document.getElementById('file-content-edit');
            const editActions = document.getElementById('file-edit-actions');
            const editBtn = document.getElementById('file-edit-btn');

            if (data.binary) {
                view.classList.remove('hidden');
                edit.classList.add('hidden');
                editActions.classList.add('hidden');
                editBtn.classList.add('hidden');
                document.getElementById('file-content-code').textContent = '(İkili dosya — metin olarak görüntülenemez)';
            } else {
                view.classList.remove('hidden');
                edit.classList.add('hidden');
                editActions.classList.add('hidden');
                editBtn.classList.remove('hidden');
                document.getElementById('file-content-code').textContent = data.content;
            }

            document.getElementById('file-modal').classList.remove('hidden');
        } catch (e) {
            App.toast('⚠️ Dosya açılamadı');
        }
    },

    toggleEdit() {
        const data = this.state.openFile;
        if (!data || data.binary) return;

        this.state.editing = !this.state.editing;
        const view = document.getElementById('file-content-view');
        const edit = document.getElementById('file-content-edit');
        const editActions = document.getElementById('file-edit-actions');

        if (this.state.editing) {
            view.classList.add('hidden');
            edit.classList.remove('hidden');
            editActions.classList.remove('hidden');
            edit.value = data.content;
            edit.focus();
        } else {
            view.classList.remove('hidden');
            edit.classList.add('hidden');
            editActions.classList.add('hidden');
        }
    },

    cancelEdit() {
        this.state.editing = false;
        document.getElementById('file-content-view').classList.remove('hidden');
        document.getElementById('file-content-edit').classList.add('hidden');
        document.getElementById('file-edit-actions').classList.add('hidden');
    },

    async saveFile() {
        const p = App.state.currentProject;
        const data = this.state.openFile;
        const content = document.getElementById('file-content-edit').value;

        try {
            await App.api('PUT', `/api/projects/${p.id}/file`, {
                path: data.path, content
            });
            data.content = content;
            document.getElementById('file-content-code').textContent = content;
            this.cancelEdit();
            App.toast('💾 Dosya kaydedildi');
        } catch (e) {
            App.toast('⚠️ Kaydetme hatası');
        }
    },

    closeFileModal() {
        document.getElementById('file-modal').classList.add('hidden');
        this.state.openFile = null;
        this.state.editing = false;
    },

    downloadFile() {
        if (!this.state.openFile) return;
        this.downloadItem(this.state.openFile.path);
    },

    downloadItem(path) {
        const p = App.state.currentProject;
        window.open(`/api/projects/${p.id}/file/download?path=${encodeURIComponent(path)}`, '_blank');
    },

    // ═══════════════════════════════════════════
    // CREATE FILE / FOLDER
    // ═══════════════════════════════════════════
    showNewFileModal() {
        document.getElementById('new-file-title').textContent = '📄 Yeni Dosya';
        document.getElementById('new-file-is-dir').value = 'false';
        document.getElementById('new-file-name').value = '';
        document.getElementById('new-file-content').value = '';
        document.getElementById('new-file-content-group').classList.remove('hidden');
        document.querySelectorAll('.toggle-btn').forEach((b, i) => b.classList.toggle('active', i === 0));
        document.getElementById('new-file-modal').classList.remove('hidden');
        document.getElementById('new-file-name').focus();
    },

    showNewFolderModal() {
        document.getElementById('new-file-title').textContent = '📁 Yeni Klasör';
        document.getElementById('new-file-is-dir').value = 'true';
        document.getElementById('new-file-name').value = '';
        document.getElementById('new-file-content-group').classList.add('hidden');
        document.querySelectorAll('.toggle-btn').forEach((b, i) => b.classList.toggle('active', i === 1));
        document.getElementById('new-file-modal').classList.remove('hidden');
        document.getElementById('new-file-name').focus();
    },

    setNewType(isDir, btn) {
        document.getElementById('new-file-is-dir').value = isDir ? 'true' : 'false';
        document.getElementById('new-file-content-group').classList.toggle('hidden', isDir);
        document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    },

    closeNewFileModal() {
        document.getElementById('new-file-modal').classList.add('hidden');
    },

    async createItem(e) {
        e.preventDefault();
        const p = App.state.currentProject;
        const isDir = document.getElementById('new-file-is-dir').value === 'true';
        const name = document.getElementById('new-file-name').value;
        const content = document.getElementById('new-file-content').value;

        try {
            await App.api('POST', `/api/projects/${p.id}/file`, {
                path: this.state.currentPath,
                name, content, is_dir: isDir
            });
            this.closeNewFileModal();
            const kind = isDir ? 'Klasör' : 'Dosya';
            App.toast(`✅ ${kind} oluşturuldu: ${name}`);
            await this.loadDir(this.state.currentPath);
        } catch (e) {
            const msg = e.message || 'Hata oluştu';
            App.toast(`⚠️ ${msg}`);
        }
    },

    // ═══════════════════════════════════════════
    // DELETE
    // ═══════════════════════════════════════════
    async deleteItem(path, name) {
        if (!confirm(`"${name}" silinsin mi?`)) return;
        const p = App.state.currentProject;

        try {
            await App.api('DELETE', `/api/projects/${p.id}/file?path=${encodeURIComponent(path)}`);
            App.toast(`🗑️ ${name} silindi`);
            await this.loadDir(this.state.currentPath);
        } catch (e) {
            App.toast('⚠️ Silme hatası');
        }
    },

    // ═══════════════════════════════════════════
    // SHARE
    // ═══════════════════════════════════════════
    showShareModal() {
        if (!this.state.openFile) return;
        this.shareItem(this.state.openFile.path, this.state.openFile.name);
    },

    shareItem(path, name) {
        const p = App.state.currentProject;
        document.getElementById('share-src-path').value = path;
        document.getElementById('share-file-info').innerHTML = `
            <strong>📄 ${App.esc(name || path)}</strong><br>
            <small>Kaynak: ${App.esc(p.name)} / ${App.esc(path)}</small>
        `;

        // Populate target projects (exclude current)
        const sel = document.getElementById('share-target-project');
        sel.innerHTML = App.state.projects
            .filter(pr => pr.id !== p.id)
            .map(pr => `<option value="${pr.id}">${pr.icon} ${App.esc(pr.name)}</option>`)
            .join('');

        document.getElementById('share-target-path').value = '';
        document.getElementById('share-modal').classList.remove('hidden');
    },

    closeShareModal() {
        document.getElementById('share-modal').classList.add('hidden');
    },

    async shareFile(e) {
        e.preventDefault();
        const p = App.state.currentProject;
        const srcPath = document.getElementById('share-src-path').value;
        const toPid = document.getElementById('share-target-project').value;
        const dstPath = document.getElementById('share-target-path').value;

        try {
            const result = await App.api('POST', '/api/files/share', {
                from_project: p.id,
                to_project: parseInt(toPid),
                src_path: srcPath,
                dst_path: dstPath
            });
            this.closeShareModal();
            this.closeFileModal();
            const target = App.state.projects.find(pr => pr.id === parseInt(toPid));
            App.toast(`📤 ${target ? target.name : 'Proje'}'ye paylaşıldı`);
        } catch (e) {
            App.toast('⚠️ Paylaşma hatası');
        }
    },

    // ═══════════════════════════════════════════
    // SEARCH
    // ═══════════════════════════════════════════
    onSearch(val) {
        this.state.searchQuery = val;
        if (!val || val.length < 2) {
            // Restore normal listing if cleared
            if (val === '') this.renderFileList(this.state.items);
            return;
        }
        clearTimeout(this._searchTimer);
        this._searchTimer = setTimeout(() => this.doSearch(), 300);
    },

    async doSearch() {
        const q = this.state.searchQuery.trim();
        if (!q || q.length < 2) return;
        const p = App.state.currentProject;

        try {
            const results = await App.api('GET', `/api/projects/${p.id}/search-files?q=${encodeURIComponent(q)}`);
            this.renderBreadcrumb('');
            document.getElementById('file-breadcrumb').innerHTML += `<span class="sep">→</span><span class="current">🔍 "${App.esc(q)}" (${results.length} sonuç)</span>`;
            this.renderFileList(results);
        } catch (e) {
            App.toast('⚠️ Arama hatası');
        }
    },

    refresh() {
        this.state.searchQuery = '';
        const input = document.getElementById('file-search-input');
        if (input) input.value = '';
        this.loadDir(this.state.currentPath);
    },

    // ═══════════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════════
    getIcon(f) {
        if (f.is_dir) return '📁';
        const ext = (f.ext || '').toLowerCase();
        const map = {
            '.py': '🐍', '.js': '🟨', '.ts': '🔷', '.jsx': '⚛️', '.tsx': '⚛️',
            '.html': '🌐', '.css': '🎨', '.scss': '🎨',
            '.json': '📋', '.yml': '⚙️', '.yaml': '⚙️', '.toml': '⚙️',
            '.md': '📝', '.txt': '📄',
            '.sh': '🖥️', '.bash': '🖥️', '.zsh': '🖥️',
            '.php': '🐘', '.vue': '💚', '.rb': '💎',
            '.sql': '🗄️', '.xml': '📰', '.csv': '📊',
            '.png': '🖼️', '.jpg': '🖼️', '.jpeg': '🖼️', '.gif': '🖼️', '.svg': '🖼️',
            '.zip': '📦', '.tar': '📦', '.gz': '📦',
            '.pdf': '📕', '.doc': '📘', '.xls': '📗',
            '.env': '🔒', '.lock': '🔐',
            '.log': '📃',
        };
        return map[ext] || '📄';
    },

    formatSize(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    },
};

// ─── Start ───
document.addEventListener('DOMContentLoaded', () => App.init());
