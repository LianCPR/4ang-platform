import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, MessageCircle, Send, Clock, CheckCircle2, XCircle, LifeBuoy } from "lucide-react";
import { api } from "../../api.js";
import { useAdminStats } from "../AdminStatsContext.jsx";
import Pill from "../components/Pill.jsx";
import { SkeletonRows } from "../components/Skeleton.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import { timeAgo } from "../../lib/format.js";

const TABS = [
  { key: "", label: "Tất cả" },
  { key: "pending", label: "Chờ phản hồi" },
  { key: "in_progress", label: "Đang xử lý" },
  { key: "resolved", label: "Đã giải quyết" },
  { key: "closed", label: "Đã đóng" },
];

const TYPE_LABELS = {
  general: "Hỗ trợ chung",
  account: "Tài khoản",
  billing: "Thanh toán",
  technical: "Kỹ thuật",
  content: "Nội dung",
  other: "Khác",
};

function TicketDetail({ ticket, onBack, onReply }) {
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleReply(newStatus) {
    if (!reply.trim() && newStatus !== ticket.status) {
      setBusy(true);
      try {
        await api.replySupportTicket(ticket.id, "", newStatus);
        onReply();
      } catch (e) {
        console.error(e);
      }
      setBusy(false);
      return;
    }
    if (!reply.trim()) return;
    setBusy(true);
    try {
      await api.replySupportTicket(ticket.id, reply, newStatus || ticket.status);
      setReply("");
      onReply();
    } catch (e) {
      console.error(e);
    }
    setBusy(false);
  }

  return (
    <div>
      <button type="button" className="link-btn" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: "var(--sp-4)" }} onClick={onBack}>
        <ArrowLeft size={14} /> Về danh sách
      </button>

      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">{ticket.subject}</h1>
          <p className="admin-page-sub">@{ticket.username} · {TYPE_LABELS[ticket.type] || ticket.type} · {timeAgo(ticket.createdAt)}</p>
        </div>
        <Pill status={ticket.status} />
      </div>

      <div className="admin-review-grid">
        <div>
          <div className="admin-card">
            <div className="admin-card-head"><h2>Nội dung yêu cầu</h2></div>
            <div className="admin-card-body">
              <p style={{ whiteSpace: "pre-wrap", fontSize: "var(--fs-sm)", color: "var(--text)", lineHeight: 1.7 }}>{ticket.message}</p>
            </div>
          </div>

          <div className="admin-card" style={{ marginTop: "var(--sp-3)" }}>
            <div className="admin-card-head"><h2>Chi tiết</h2></div>
            <div className="admin-card-body">
              <dl className="admin-kv">
                <div className="admin-kv-row"><dt>Loại</dt><dd>{TYPE_LABELS[ticket.type] || ticket.type}</dd></div>
                <div className="admin-kv-row"><dt>Người gửi</dt><dd>@{ticket.username}</dd></div>
                <div className="admin-kv-row"><dt>Trạng thái</dt><dd>{ticket.status}</dd></div>
                <div className="admin-kv-row"><dt>Gửi lúc</dt><dd>{new Date(ticket.createdAt).toLocaleString("vi-VN")}</dd></div>
                <div className="admin-kv-row"><dt>Cập nhật</dt><dd>{new Date(ticket.updatedAt).toLocaleString("vi-VN")}</dd></div>
              </dl>
            </div>
          </div>
        </div>

        <div>
          {ticket.adminReply && (
            <div className="admin-card" style={{ borderLeft: "3px solid var(--c-sage-deep)" }}>
              <div className="admin-card-head"><h2>Phản hồi trước đó</h2></div>
              <div className="admin-card-body">
                <p style={{ whiteSpace: "pre-wrap", fontSize: "var(--fs-sm)", color: "var(--text)", lineHeight: 1.7 }}>{ticket.adminReply}</p>
              </div>
            </div>
          )}

          <div className="admin-card">
            <div className="admin-card-head"><h2>Phản hồi mới</h2></div>
            <div className="admin-card-body" style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
              <textarea
                style={{ width: "100%", minHeight: 100, padding: "var(--sp-3)", border: "1.5px solid var(--divider)", borderRadius: "var(--r-btn)", background: "var(--surface-warm)", fontSize: "var(--fs-sm)", resize: "vertical", fontFamily: "inherit", color: "var(--text-bright)" }}
                placeholder="Nhập phản hồi cho người dùng..."
                value={reply}
                onChange={(e) => setReply(e.target.value)}
              />
              <div style={{ display: "flex", gap: "var(--sp-2)", flexWrap: "wrap" }}>
                <button className="btn-primary" disabled={busy || !reply.trim()} onClick={() => handleReply("resolved")}>
                  <Send size={14} /> Gửi & Đã giải quyết
                </button>
                <button className="btn-secondary" disabled={busy || !reply.trim()} onClick={() => handleReply("in_progress")}>
                  <Send size={14} /> Gửi & Đang xử lý
                </button>
                {ticket.status !== "closed" && (
                  <button className="btn-secondary" disabled={busy} onClick={() => handleReply("closed")}>
                    <XCircle size={14} /> Đóng ticket
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SupportTicketsPage({ showToast }) {
  const [status, setStatus] = useState("");
  const [tickets, setTickets] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedTicket, setSelectedTicket] = useState(null);

  function load() {
    setTickets(null);
    api.admin.supportTickets(status).then((res) => setTickets(res.tickets)).catch(() => setTickets([]));
  }
  useEffect(() => { load(); }, [status]);

  function openTicket(id) {
    setSelectedId(id);
    api.admin.supportTickets("").then((res) => {
      const t = res.tickets.find((tk) => tk.id === id);
      setSelectedTicket(t || null);
    }).catch(() => {});
  }

  if (selectedTicket) {
    return (
      <TicketDetail
        ticket={selectedTicket}
        onBack={() => { setSelectedId(null); setSelectedTicket(null); load(); }}
        onReply={() => { openTicket(selectedId); load(); }}
      />
    );
  }

  return (
    <div>
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Hỗ trợ</h1>
          <p className="admin-page-sub">Yêu cầu hỗ trợ từ người dùng — phản hồi và quản lý ticket.</p>
        </div>
      </div>

      <div className="admin-filter-row">
        {TABS.map((t) => (
          <button key={t.key} className={"admin-filter-tab" + (status === t.key ? " active" : "")} onClick={() => setStatus(t.key)}>{t.label}</button>
        ))}
      </div>

      <div className="admin-card">
        <div className="admin-card-body" style={{ paddingTop: "var(--sp-3)" }}>
          {tickets === null ? <SkeletonRows count={5} withArt={false} /> : tickets.length === 0 ? (
            <EmptyState title="Không có ticket hỗ trợ" subtitle="Khi người dùng gửi yêu cầu hỗ trợ, chúng sẽ hiện ở đây." />
          ) : (
            <div className="admin-row-list">
              {tickets.map((t) => (
                <div className="admin-row" key={t.id} style={{ cursor: "pointer" }} onClick={() => openTicket(t.id)}>
                  <LifeBuoy size={16} style={{ flexShrink: 0, color: "var(--text-faint)" }} />
                  <div className="admin-row-main">
                    <div className="admin-row-title">{t.subject}</div>
                    <div className="admin-row-sub">
                      @{t.username} · {TYPE_LABELS[t.type] || t.type} · {timeAgo(t.createdAt)}
                    </div>
                  </div>
                  <div className="admin-row-meta">
                    <Pill status={t.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
