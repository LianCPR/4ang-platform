import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, BellOff, CheckCheck, Clock, Music, Users, MessageCircle, Star,
  AlertTriangle, CheckCircle, Send, Headphones, Disc3, Shield, ChevronRight, XCircle
} from "lucide-react";
import { api } from "../api";
import { timeAgo } from "../lib/format";

/* ─── Notification type config ────────────── */
const NOTIF_CONFIG = {
  NEW_RELEASE: { icon: Disc3, color: "var(--c-sage-deep)", label: "Phát hành mới" },
  TRACK_PUBLISHED: { icon: CheckCircle, color: "var(--success)", label: "Đã xuất bản" },
  ARTIST_FOLLOWED: { icon: Users, color: "var(--c-gold)", label: "Người theo dõi" },
  ARTIST_APPROVED: { icon: Star, color: "var(--c-sage-deep)", label: "Nghệ sĩ" },
  ARTIST_REJECTED: { icon: AlertTriangle, color: "var(--danger)", label: "Yêu cầu" },
  ARTIST_VERIFIED: { icon: Shield, color: "var(--c-sage-deep)", label: "Xác minh" },
  ARTIST_VERIFICATION_REJECTED: { icon: AlertTriangle, color: "var(--danger)", label: "Xác minh" },
  SUBMISSION_APPROVED: { icon: CheckCircle, color: "var(--success)", label: "Đã duyệt" },
  SUBMISSION_REJECTED: { icon: XCircle, color: "var(--danger)", label: "Bị từ chối" },
  SUBMISSION_PUBLISHED: { icon: Music, color: "var(--c-sage-deep)", label: "Đã phát hành" },
  SUPPORT_TICKET_UPDATE: { icon: MessageCircle, color: "var(--c-gold)", label: "Hỗ trợ" },
  SYSTEM: { icon: Bell, color: "var(--text-muted)", label: "Hệ thống" },
};

/* ─── Group notifications by date ─────────── */
function groupByDate(notifs) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86400000;
  const weekAgo = today - 7 * 86400000;

  const groups = { "Hôm nay": [], "Hôm qua": [], "7 ngày gần đây": [], "Trước đó": [] };
  for (const n of notifs) {
    const t = n.createdAt;
    if (t >= today) groups["Hôm nay"].push(n);
    else if (t >= yesterday) groups["Hôm qua"].push(n);
    else if (t >= weekAgo) groups["7 ngày gần đây"].push(n);
    else groups["Trước đó"].push(n);
  }
  return Object.entries(groups).filter(([, items]) => items.length > 0);
}

/* ─── Notification Item ───────────────────── */
function NotificationItem({ notif, onRead, onNavigate, index }) {
  const config = NOTIF_CONFIG[notif.type] || NOTIF_CONFIG.SYSTEM;
  const Icon = config.icon;

  const handleClick = useCallback(() => {
    if (!notif.read) onRead(notif.id);
    // Deep-link based on target type
    if (notif.targetType === "track" && notif.targetId) {
      onNavigate("track", notif.targetId);
    } else if (notif.targetType === "artist" && notif.targetId) {
      onNavigate("artist", notif.targetId);
    } else if (notif.targetType === "artist_application" || notif.targetType === "verified_application") {
      onNavigate("profile");
    } else if (notif.targetType === "submission") {
      onNavigate("dashboard");
    } else if (notif.targetType === "playlist" && notif.targetId) {
      onNavigate("playlist", notif.targetId);
    } else if (notif.targetType === "support_ticket") {
      onNavigate("support");
    }
  }, [notif, onRead, onNavigate]);

  return (
    <motion.button
      type="button"
      className={"notif-item" + (notif.read ? "" : " notif-unread")}
      onClick={handleClick}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.02, 0.3) }}
    >
      <div className="notif-icon" style={{ color: config.color, background: config.color + "12" }}>
        <Icon size={16} />
      </div>
      <div className="notif-body">
        <div className="notif-header-row">
          <span className="notif-type-badge" style={{ color: config.color }}>{config.label}</span>
          <span className="notif-time">{timeAgo(notif.createdAt)}</span>
        </div>
        <div className="notif-title">{notif.title}</div>
        {notif.body && <div className="notif-text">{notif.body}</div>}
      </div>
      {!notif.read && <div className="notif-dot" />}
      <ChevronRight size={14} className="notif-arrow" />
    </motion.button>
  );
}

/* ══════════════════════════════════════════ */
export default function NotificationsPage({ session, onOpenTrack, onOpenArtist }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all | unread

  useEffect(() => { loadNotifications(); }, []);

  async function loadNotifications() {
    setLoading(true);
    try {
      const [notifs, count] = await Promise.all([
        api.notifications(50).catch(() => ({ notifications: [], unreadCount: 0 })),
        api.unreadNotificationCount().catch(() => ({ count: 0 })),
      ]);
      setNotifications(notifs.notifications || []);
      setUnreadCount(count.count || 0);
    } catch (e) { /* ignore */ }
    setLoading(false);
  }

  async function markRead(id) {
    try {
      await api.markNotificationRead(id);
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (e) { /* ignore */ }
  }

  async function markAllRead() {
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (e) { /* ignore */ }
  }

  function handleNavigate(type, id) {
    if (type === "track" && onOpenTrack) onOpenTrack(id);
    else if (type === "artist" && onOpenArtist) onOpenArtist(id);
  }

  const filtered = filter === "unread"
    ? notifications.filter((n) => !n.read)
    : notifications;

  const grouped = groupByDate(filtered);

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="notif-page">
        <div className="notif-header">
          <h1 className="notif-page-title">Thông báo</h1>
        </div>
        <div className="notif-skeleton-list">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="notif-skeleton-item" style={{ animationDelay: `${i * 0.1}s` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="notif-page">
      {/* ── Header ── */}
      <div className="notif-header">
        <h1 className="notif-page-title">Thông báo</h1>
        <div className="notif-header-actions">
          {unreadCount > 0 && (
            <button type="button" className="btn-secondary btn-sm" onClick={markAllRead}>
              <CheckCheck size={14} /> Đọc tất cả ({unreadCount})
            </button>
          )}
        </div>
      </div>

      {/* ── Filter tabs ── */}
      <div className="notif-filters">
        <button
          type="button"
          className={"notif-filter-btn" + (filter === "all" ? " active" : "")}
          onClick={() => setFilter("all")}
        >
          Tất cả
          <span className="notif-filter-count">{notifications.length}</span>
        </button>
        <button
          type="button"
          className={"notif-filter-btn" + (filter === "unread" ? " active" : "")}
          onClick={() => setFilter("unread")}
        >
          Chưa đọc
          {unreadCount > 0 && <span className="notif-filter-count">{unreadCount}</span>}
        </button>
      </div>

      {/* ── Notification list ── */}
      {filtered.length === 0 ? (
        <div className="notif-empty">
          <BellOff size={40} strokeWidth={1} style={{ color: "var(--c-sage)", opacity: 0.25 }} />
          <h3>{filter === "unread" ? "Không có thông báo chưa đọc" : "Chưa có thông báo"}</h3>
          <p>{filter === "unread"
            ? "Tất cả thông báo đã được đọc."
            : "Khi có hoạt động mới, bạn sẽ thấy thông báo ở đây."
          }</p>
        </div>
      ) : (
        <div className="notif-groups">
          {grouped.map(([dateLabel, items]) => (
            <div key={dateLabel} className="notif-group">
              <div className="notif-group-label">{dateLabel}</div>
              {items.map((n, i) => (
                <NotificationItem
                  key={n.id}
                  notif={n}
                  onRead={markRead}
                  onNavigate={handleNavigate}
                  index={i}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
