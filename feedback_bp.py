"""
Emare Feedback Blueprint — Flask Template v1.0
Kullanım:
    from feedback_bp import feedback_bp
    app.register_blueprint(feedback_bp)
"""
import uuid
from datetime import datetime

from flask import Blueprint, jsonify, request
from flask_login import current_user
from flask_sqlalchemy import SQLAlchemy

# db'yi proje extensions'ından al
try:
    from extensions import db
except ImportError:
    db = None  # app.py'de db = SQLAlchemy(app) olmalı

feedback_bp = Blueprint("feedback", __name__, url_prefix="/api/feedback")


# ── Model ──────────────────────────────────────────────────────────────
class FeedbackMsg(db.Model):
    __tablename__ = "em_feedback"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    message = db.Column(db.Text, nullable=False)
    category = db.Column(db.String(20), default="bug")    # bug|suggestion|question|other
    priority = db.Column(db.String(20), default="normal") # low|normal|high|critical
    status = db.Column(db.String(20), default="open")     # open|in_progress|resolved|closed
    page_url = db.Column(db.String(500), nullable=True)
    admin_reply = db.Column(db.Text, nullable=True)
    replied_by = db.Column(db.Integer, nullable=True)
    replied_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    CATEGORY_LABELS = {"bug": "Hata", "suggestion": "Öneri", "question": "Soru", "other": "Diğer"}
    STATUS_LABELS = {"open": "Açık", "in_progress": "İnceleniyor", "resolved": "Çözüldü", "closed": "Kapatıldı"}

    def to_dict(self):
        return {
            "id": self.id,
            "message": self.message,
            "category": self.category,
            "category_label": self.CATEGORY_LABELS.get(self.category, self.category),
            "priority": self.priority,
            "status": self.status,
            "status_label": self.STATUS_LABELS.get(self.status, self.status),
            "page_url": self.page_url,
            "admin_reply": self.admin_reply,
            "replied_at": self.replied_at.isoformat() if self.replied_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


# ── Routes ──────────────────────────────────────────────────────────────
@feedback_bp.route("/", methods=["POST"])
def create_feedback():
    data = request.get_json(silent=True) or {}
    msg = (data.get("message") or "").strip()
    if len(msg) < 3:
        return jsonify({"success": False, "message": "Mesaj en az 3 karakter olmalı"}), 400

    fb = FeedbackMsg(
        user_id=current_user.id if current_user.is_authenticated else None,
        message=msg,
        category=data.get("category", "bug"),
        priority=data.get("priority", "normal"),
        page_url=data.get("page_url") or request.referrer,
    )
    db.session.add(fb)
    db.session.commit()
    return jsonify({"success": True, "message": "Geri bildiriminiz alındı. Teşekkür ederiz!", "feedback": fb.to_dict()})


@feedback_bp.route("/my", methods=["GET"])
def my_feedbacks():
    uid = current_user.id if current_user.is_authenticated else None
    q = FeedbackMsg.query
    if uid:
        q = q.filter_by(user_id=uid)
    feedbacks = q.order_by(FeedbackMsg.created_at.desc()).limit(50).all()
    if request.is_json or request.headers.get("X-Requested-With") == "XMLHttpRequest":
        return jsonify({"messages": [f.to_dict() for f in feedbacks]})
    return jsonify({"messages": [f.to_dict() for f in feedbacks]})


@feedback_bp.route("/", methods=["GET"])
def list_feedbacks():
    q = FeedbackMsg.query
    status = request.args.get("status")
    category = request.args.get("category")
    if status:
        q = q.filter_by(status=status)
    if category:
        q = q.filter_by(category=category)
    feedbacks = q.order_by(FeedbackMsg.created_at.desc()).all()
    total = FeedbackMsg.query.count()
    open_c = FeedbackMsg.query.filter_by(status="open").count()
    return jsonify({
        "feedbacks": [f.to_dict() for f in feedbacks],
        "stats": {"total": total, "open": open_c, "resolved": FeedbackMsg.query.filter_by(status="resolved").count()},
    })


@feedback_bp.route("/<fb_id>/status", methods=["PATCH"])
def update_status(fb_id):
    fb = FeedbackMsg.query.get_or_404(fb_id)
    data = request.get_json(silent=True) or {}
    status = data.get("status", "")
    if status not in ("open", "in_progress", "resolved", "closed"):
        return jsonify({"success": False, "message": "Geçersiz durum"}), 400
    fb.status = status
    db.session.commit()
    return jsonify({"success": True, "feedback": fb.to_dict()})


@feedback_bp.route("/<fb_id>/reply", methods=["POST"])
def reply_feedback(fb_id):
    fb = FeedbackMsg.query.get_or_404(fb_id)
    data = request.get_json(silent=True) or {}
    reply = (data.get("admin_reply") or "").strip()
    if len(reply) < 2:
        return jsonify({"success": False, "message": "Yanıt en az 2 karakter olmalı"}), 400
    fb.admin_reply = reply
    fb.replied_at = datetime.utcnow()
    fb.replied_by = current_user.id if current_user.is_authenticated else None
    if fb.status == "open":
        fb.status = "in_progress"
    db.session.commit()
    return jsonify({"success": True, "feedback": fb.to_dict()})
