import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Heart, MessageCircle, Music, Play, UserPlus, Compass } from "lucide-react";
import { api } from "../api";
import { gradientFor, hashHue, timeAgo, formatCount } from "../lib/format";
import { ACTIVITY_CONFIG } from "../lib/activity";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";

function FeedItem({ activity, onOpenPost, onPlay, onOpenArtist, session, onFollowUser, onReact }) {
  const config = ACTIVITY_CONFIG[activity.eventType] || { icon: Music, color: "var(--text-muted)", verb: "đã tương tác" };
  const Icon = config.icon;
  const target = activity.target;

  return (
    <motion.div
      className="feed-item"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* Header — click opens post detail */}
      <div className="feed-item-header" onClick={() => onOpenPost && onOpenPost(activity.id)}>
        <div className="feed-avatar" style={activity.avatarUrl
          ? { backgroundImage: `url('${activity.avatarUrl}')` }
          : { background: gradientFor(hashHue(activity.username)) }
        }>
          {!activity.avatarUrl && <span style={{ fontSize: 12, fontWeight: 600 }}>{(activity.displayName || "U")[0]}</span>}
        </div>
        <div className="feed-user-info">
          <span className="feed-username">{activity.displayName}</span>
          <span className="feed-activity-text">
            <Icon size={13} style={{ color: config.color }} /> {config.verb}
          </span>
        </div>
        <span className="feed-time">{timeAgo(activity.createdAt)}</span>
      </div>

      {/* Message */}
      {activity.message && (
        <p className="feed-message" onClick={() => onOpenPost && onOpenPost(activity.id)}>{activity.message}</p>
      )}

      {/* Target content */}
      {target && target.type === "track" && (
        <div className="feed-track-card" onClick={() => onOpenPost && onOpenPost(activity.id)}>
          <div className="feed-track-art" style={target.coverUrl
            ? { backgroundImage: `url('${target.coverUrl}')` }
            : { background: gradientFor(hashHue(target.title)) }
          }>
            <div className="feed-track-play">
              <Play size={16} fill="white" />
            </div>
          </div>
          <div className="feed-track-info">
            <div className="feed-track-title">{target.title}</div>
            <div className="feed-track-artist">{target.artist}</div>
          </div>
        </div>
      )}

      {target && target.type === "playlist" && (
        <div className="feed-track-card" onClick={() => onOpenPost && onOpenPost(activity.id)}>
          <div className="feed-track-art" style={target.coverUrl
            ? { backgroundImage: `url('${target.coverUrl}')` }
            : { background: gradientFor(hashHue(target.title)) }
          }>
            <div className="feed-track-play">
              <Music size={16} />
            </div>
          </div>
          <div className="feed-track-info">
            <div className="feed-track-title">{target.title}</div>
            <div className="feed-track-artist">{target.trackCount} bài hát</div>
          </div>
        </div>
      )}

      {target && target.type === "artist" && (
        <div className="feed-track-card" onClick={() => onOpenArtist && onOpenArtist(target.username)}>
          <div className="feed-track-art" style={{ background: gradientFor(hashHue(target.username)), borderRadius: "50%" }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "white" }}>{(target.name || "A")[0]}</span>
          </div>
          <div className="feed-track-info">
            <div className="feed-track-title">{target.name}</div>
            <div className="feed-track-artist">Nghệ sĩ</div>
          </div>
        </div>
      )}

      {target && target.type === "user" && (
        <div className="feed-track-card">
          <div className="feed-track-art" style={{ background: gradientFor(hashHue(target.username)), borderRadius: "50%" }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "white" }}>{(target.name || "U")[0]}</span>
          </div>
          <div className="feed-track-info">
            <div className="feed-track-title">{target.name}</div>
            <div className="feed-track-artist">@{target.username}</div>
          </div>
          {session && target.username !== session.username && (
            <button type="button" className="btn-secondary" style={{ marginLeft: "auto", fontSize: 12, padding: "4px 12px" }}
              onClick={(e) => { e.stopPropagation(); onFollowUser && onFollowUser(target.username); }}>
              <UserPlus size={12} /> Theo dõi
            </button>
          )}
        </div>
      )}

      {/* Stats + actions */}
      <div className="feed-item-stats">
        <span>{formatCount(activity.likeCount || 0)} tym</span>
        <span>{formatCount(activity.commentCount || 0)} bình luận</span>
      </div>
      <div className="feed-item-actions">
        <button
          type="button"
          className={"feed-action-btn" + (activity.reacted ? " active" : "")}
          onClick={() => onReact && onReact(activity)}
        >
          <Heart size={16} fill={activity.reacted ? "currentColor" : "none"} />
          <span>Tym</span>
        </button>
        <button type="button" className="feed-action-btn" onClick={() => onOpenPost && onOpenPost(activity.id)}>
          <MessageCircle size={16} />
          <span>{formatCount(activity.commentCount || 0)}</span>
        </button>
      </div>
    </motion.div>
  );
}

export default function SocialFeedPage({ session, onPlay, current, isPlaying, onOpenArtist, onOpenPost }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadFeed = useCallback(async (before) => {
    try {
      const res = await api.feed(20, before);
      if (before) {
        setActivities(prev => [...prev, ...res.activities]);
      } else {
        setActivities(res.activities || []);
      }
      setHasMore(res.hasMore || false);
    } catch (e) {
      setError(e.message || "Không thể tải feed.");
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadFeed().finally(() => setLoading(false));
  }, [loadFeed]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || activities.length === 0) return;
    setLoadingMore(true);
    await loadFeed(activities[activities.length - 1]?.createdAt);
    setLoadingMore(false);
  }, [loadingMore, hasMore, activities, loadFeed]);

  const handleFollowUser = async (username) => {
    try {
      await api.followUser(username);
    } catch (e) { /* ignore */ }
  };

  // Optimistic post reaction toggle
  const handleReact = async (activity) => {
    const was = activity.reacted;
    setActivities((prev) => prev.map((a) => a.id === activity.id
      ? { ...a, reacted: !was, likeCount: (a.likeCount || 0) + (was ? -1 : 1) }
      : a));
    try {
      const res = await api.reactPost(activity.id);
      setActivities((prev) => prev.map((a) => a.id === activity.id
        ? { ...a, reacted: res.reacted, likeCount: res.likeCount }
        : a));
    } catch (e) {
      setActivities((prev) => prev.map((a) => a.id === activity.id
        ? { ...a, reacted: was, likeCount: (a.likeCount || 0) + (was ? 1 : -1) }
        : a));
    }
  };

  if (loading) {
    return (
      <div className="feed-page">
        <div className="feed-header">
          <h1 className="feed-title">Hoạt động</h1>
        </div>
        <div className="feed-list">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="feed-item" style={{ opacity: 0.5, animation: `skeleton-pulse 1.4s ease-in-out infinite ${i * 0.05}s` }}>
              <div className="feed-item-header">
                <div className="feed-avatar" style={{ background: "var(--bg-muted)" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ width: "40%", height: 12, borderRadius: 4, background: "var(--bg-muted)", marginBottom: 4 }} />
                  <div style={{ width: "60%", height: 10, borderRadius: 4, background: "var(--bg-muted)" }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="feed-page">
        <div className="feed-header">
          <h1 className="feed-title">Hoạt động</h1>
        </div>
        <ErrorState message={error} onRetry={() => { setError(null); setLoading(true); loadFeed().finally(() => setLoading(false)); }} />
      </div>
    );
  }

  return (
    <div className="feed-page">
      <div className="feed-header">
        <h1 className="feed-title">Hoạt động</h1>
        <p className="feed-subtitle">Cập nhật từ những người bạn theo dõi</p>
      </div>

      {activities.length === 0 ? (
        <EmptyState
          icon={Compass}
          title="Chưa có hoạt động"
          subtitle="Theo dõi nghệ sĩ và bạn bè để xem hoạt động của họ tại đây."
        />
      ) : (
        <div className="feed-list">
          {activities.map((activity) => (
            <FeedItem
              key={activity.id}
              activity={activity}
              onOpenPost={onOpenPost}
              onPlay={(trackId) => {
                if (onPlay) onPlay([], 0, trackId);
              }}
              onOpenArtist={onOpenArtist}
              session={session}
              onFollowUser={handleFollowUser}
              onReact={handleReact}
            />
          ))}

          {hasMore && (
            <div style={{ textAlign: "center", padding: "var(--sp-4)" }}>
              <button type="button" className="btn-secondary" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? "Đang tải..." : "Xem thêm"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
