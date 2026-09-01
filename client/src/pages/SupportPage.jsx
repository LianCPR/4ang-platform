import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Send, MessageCircle, Clock, CheckCircle, AlertCircle, Headphones, Mail, HelpCircle } from "lucide-react";
import { api } from "../api";

const TICKET_TYPES = [
  { value: "general", label: "Hỏi chung" },
  { value: "account", label: "Tài khoản" },
  { value: "artist", label: "Nghệ sĩ" },
  { value: "bug", label: "Báo lỗi" },
  { value: "feature", label: "Đề xuất tính năng" },
  { value: "other", label: "Khác" },
];

const STATUS_MAP = {
  pending: { label: "Đang chờ", icon: Clock, color: "var(--c-gold)" },
  in_progress: { label: "Đang xử lý", icon: AlertCircle, color: "var(--c-sage)" },
  resolved: { label: "Đã giải quyết", icon: CheckCircle, color: "var(--success)" },
  closed: { label: "Đã đóng", icon: CheckCircle, color: "var(--text-faint)" },
};

function TicketCard({ ticket, onClick }) {
  const status = STATUS_MAP[ticket.status] || STATUS_MAP.pending;
  const StatusIcon = status.icon;
  return (
    <button type="button" className="support-ticket-card" onClick={onClick}>
      <div className="support-ticket-header">
        <span className="support-ticket-id">#{ticket.id.slice(0, 8)}</span>
        <span className="support-ticket-status" style={{ color: status.color }}>
          <StatusIcon size={12} /> {status.label}
        </span>
      </div>
      <div className="support-ticket-subject">{ticket.subject}</div>
      <div className="support-ticket-meta">
        <span>{TICKET_TYPES.find((t) => t.value === ticket.type)?.label || ticket.type}</span>
        <span>·</span>
        <span>{new Date(ticket.createdAt).toLocaleDateString("vi-VN")}</span>
      </div>
    </button>
  );
}

export default function SupportPage({ session, showToast, onBack }) {
  const [view, setView] = useState("list"); // list | create | detail
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [loading, setLoading] = useState(false);

  // Create form
  const [type, setType] = useState("general");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadTickets();
  }, []);

  async function loadTickets() {
    setLoading(true);
    try {
      const res = await api.mySupportTickets();
      setTickets(res.tickets || []);
    } catch (e) { /* no tickets endpoint yet */ }
    setLoading(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) { showToast("Vui lòng điền đầy đủ."); return; }
    setSubmitting(true);
    try {
      const res = await api.createSupportTicket({ type, subject: subject.trim(), message: message.trim() });
      setTickets((prev) => [res.ticket, ...prev]);
      setView("list");
      setSubject(""); setMessage(""); setType("general");
      showToast("Đã gửi yêu cầu hỗ trợ.");
    } catch (e) {
      showToast(e.message || "Có lỗi xảy ra.");
    }
    setSubmitting(false);
  }

  return (
    <div className="support-page">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <div className="settings-header">
          <button type="button" className="link-btn" onClick={view === "list" ? onBack : () => setView("list")}>
            <ArrowLeft size={16} /> {view === "list" ? "Quay lại" : "Danh sách"}
          </button>
          <h1 className="settings-title">
            {view === "list" ? "Hỗ trợ" : view === "create" ? "Gửi yêu cầu" : "Chi tiết yêu cầu"}
          </h1>
        </div>

        <AnimatePresence mode="wait">
          {view === "list" && (
            <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {/* Hero info */}
              <div className="support-hero">
                <div className="support-hero-icon">
                  <Headphones size={28} style={{ color: "var(--c-sage)" }} />
                </div>
                <h2>Bạn cần hỗ trợ?</h2>
                <p>Liên hệ đội ngũ hỗ trợ 4ANG hoặc gửi yêu cầu để được giải quyết.</p>
                <div className="support-contact-options">
                  <div className="support-contact-card">
                    <Mail size={18} />
                    <span>heiennek286@gmail.com</span>
                  </div>
                  <div className="support-contact-card">
                    <HelpCircle size={18} />
                    <span>Câu hỏi thường gặp</span>
                  </div>
                </div>
              </div>

              <div className="support-actions">
                <button type="button" className="btn-primary" onClick={() => setView("create")}>
                  <Send size={15} /> Gửi yêu cầu hỗ trợ
                </button>
              </div>

              {tickets.length > 0 && (
                <div className="support-ticket-list">
                  <h3 className="support-section-title">Yêu cầu của bạn</h3>
                  {tickets.map((t) => (
                    <TicketCard key={t.id} ticket={t} onClick={() => { setSelectedTicket(t); setView("detail"); }} />
                  ))}
                </div>
              )}

              {tickets.length === 0 && !loading && (
                <div className="support-empty">
                  <MessageCircle size={32} style={{ opacity: 0.15, color: "var(--c-sage)" }} />
                  <p>Chưa có yêu cầu hỗ trợ nào.</p>
                </div>
              )}
            </motion.div>
          )}

          {view === "create" && (
            <motion.div key="create" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <form className="support-form" onSubmit={handleSubmit}>
                <div className="settings-section">
                  <div className="ba-field">
                    <label className="ba-label">Loại yêu cầu</label>
                    <select className="ba-input" value={type} onChange={(e) => setType(e.target.value)}>
                      {TICKET_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div className="ba-field">
                    <label className="ba-label">Tiêu đề <span className="ba-required">*</span></label>
                    <input className="ba-input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Mô tả ngắn gọn vấn đề của bạn" maxLength={120} />
                  </div>
                  <div className="ba-field">
                    <label className="ba-label">Nội dung <span className="ba-required">*</span></label>
                    <textarea className="ba-textarea" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Mô tả chi tiết vấn đề, câu hỏi hoặc đề xuất của bạn..." rows={6} maxLength={2000} />
                    <span className="ba-char-count">{message.length}/2000</span>
                  </div>
                </div>
                <div className="support-form-actions">
                  <button type="button" className="btn-secondary" onClick={() => setView("list")}>Huỷ</button>
                  <button type="submit" className="btn-primary" disabled={submitting || !subject.trim() || !message.trim()}>
                    {submitting ? <span className="btn-busy"><span className="busy-dot" /> Đang gửi...</span> : <><Send size={15} /> Gửi yêu cầu</>}
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {view === "detail" && selectedTicket && (
            <motion.div key="detail" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="support-detail">
                <div className="support-detail-header">
                  <span className="support-ticket-id">#{selectedTicket.id.slice(0, 8)}</span>
                  <span className="support-ticket-status" style={{ color: (STATUS_MAP[selectedTicket.status] || STATUS_MAP.pending).color }}>
                    {(STATUS_MAP[selectedTicket.status] || STATUS_MAP.pending).label}
                  </span>
                </div>
                <h2 className="support-detail-subject">{selectedTicket.subject}</h2>
                <div className="support-detail-meta">
                  <span>{TICKET_TYPES.find((t) => t.value === selectedTicket.type)?.label}</span>
                  <span>·</span>
                  <span>{new Date(selectedTicket.createdAt).toLocaleString("vi-VN")}</span>
                </div>
                <div className="support-detail-message">{selectedTicket.message}</div>
                {selectedTicket.adminReply && (
                  <div className="support-detail-reply">
                    <div className="support-reply-label"><Headphones size={14} /> Phản hồi từ 4ANG</div>
                    <p>{selectedTicket.adminReply}</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
