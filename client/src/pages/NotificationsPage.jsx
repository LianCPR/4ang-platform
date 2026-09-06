import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  BellOff, CheckCheck, AlertTriangle, ChevronRight, MessageCircle
} from "lucide-react";
import { api } from "../api";
import { timeAgo, gradientFor, hashHue } from "../lib/format";
import { NOTIFICATION_CONFIG } from "../lib/activity";

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
  const config = NOTIFICATION_CONFIG[notif.type] || NOTIFICATION_CONFIG.SYSTEM;
  const Icon = config.icon;
  const isSocial = ["COMMENT_REPLY", "MENTION", "COMMENT_LIKED", "POST_LIKED", "NEW_COMMENT", "ROOM_INVITE"].includes(notif.type);

  const handleClick = useCallback(() => {
    if (!notif.read) onRead(notif.id);
    // Deep-link based on target type
    if (notif.targetType === "track" && notif.targetId) {
      onNavigate("track", notif.targetId);
    } else if (notif.targetType === "artist" && notif.targetId) {
      onNavigate("artist", notif.targetId);
    } else if (notif.targetType === "post" && notif.targetId) {
      onNavigate("post", notif.targetId, notif.metadata?.commentId || null);
    } else if (notif.targetType === "room" && notif.targetId) {
      onNavigate("room", notif.targetId);
    } else if (notif.targetType === "playlist" && notif.targetId) {
      onNavigate("playlist", notif.targetId);
    } else if (notif.targetType === "artist_application" || notif.targetType === "verified_application") {
      onNavigate("profile");
    } else if (notif.targetType === "submission") {
      onNavigate("dashboard");
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
      {isSocial ? (
        <div className="notif-avatar" style={notif.actorAvatar
          ? { backgroundImage: `url('${notif.actorAvatar}')` }
          : { background: gradientFor(hashHue(notif.actorUsername || "u")) }
        }>
          {!notif.actorAvatar && <span>{(notif.actorDisplayName || "U")[0]}</span>}
        </div>
      ) : (
        <div className="notif-icon" style={{ color: config.color, background: config.color + "12" }}>
          <Icon size={16} />
        </div>
      )}
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
export default function NotificationsPage({ session, onOpenTrack, onOpenArtist, onOpenPost, onOpenRoom, onOpenPlaylist }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all"); // all | unread

  useEffect(() => { loadNotifications(); }, []);

  async function loadNotifications() {
    setLoading(true);
    setError(null);
    try {
      const [notifs, count] = await Promise.all([
        api.notifications(50),
        api.unreadNotificationCount(),
      ]);
      setNotifications(notifs.notifications || []);
      setUnreadCount(count.count || 0);
    } catch (e) {
      setError(e.message || "Không thể tải thông báo.");
    }
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

  function handleNavigate(type, id, commentId) {
    if (type === "track" && onOpenTrack) onOpenTrack(id);
    else if (type === "artist" && onOpenArtist) onOpenArtist(id);
    else if (type === "post" && onOpenPost) onOpenPost(id, commentId);
    else if (type === "room" && onOpenRoom) onOpenRoom(id);
    else if (type === "playlist" && onOpenPlaylist) onOpenPlaylist(id);
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

  /* ── Error ── */
  if (error) {
    return (
      <div className="notif-page">
        <div className="notif-header">
          <h1 className="notif-page-title">Thông báo</h1>
        </div>
        <div className="notif-empty">
          <AlertTriangle size={40} strokeWidth={1} style={{ color: "var(--danger)", opacity: 0.4 }} />
          <h3>Không thể tải thông báo</h3>
          <p>{error}</p>
          <button type="button" className="btn-secondary" onClick={loadNotifications} style={{ marginTop: "var(--sp-2)" }}>Thử lại</button>
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