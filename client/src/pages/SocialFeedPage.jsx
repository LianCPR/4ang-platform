import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Heart, Music, Users, UserPlus, Share2, ListMusic, Play, Clock, Sparkles, Compass } from "lucide-react";
import { api } from "../api";
import { gradientFor, hashHue, timeAgo } from "../lib/format";
import ArtistBadge from "../components/ArtistBadge";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";

const ACTIVITY_CONFIG = {
  SONG_LIKED: { icon: Heart, color: "var(--c-rose)", verb: "đã thích" },
  SONG_SHARED: { icon: Share2, color: "var(--c-sage)", verb: "đã chia sẻ" },
  SHARED: { icon: Share2, color: "var(--c-sage)", verb: "đã chia sẻ" },
  PLAYLIST_CREATED: { icon: ListMusic, color: "var(--c-gold)", verb: "đã tạo playlist" },
  ARTIST_FOLLOWED: { icon: UserPlus, color: "var(--c-sage-deep)", verb: "đã theo dõi" },
  USER_FOLLOWED: { icon: UserPlus, color: "var(--c-sage-deep)", verb: "đã theo dõi" },
  NEW_RELEASE: { icon: Music, color: "var(--c-sage)", verb: "đã phát hành" },
  TRACK_PUBLISHED: { icon: Music, color: "var(--c-sage)", verb: "đã phát hành" },
  ARTIST_APPROVED: { icon: Sparkles, color: "var(--c-gold)", verb: "đã được xác minh" },
};

function FeedItem({ activity, onPlay, onOpenArtist, current, isPlaying, session, onFollowUser }) {
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
      {/* Header */}
      <div className="feed-item-header">
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
        <p className="feed-message">{activity.message}</p>
      )}

      {/* Target content */}
      {target && target.type === "track" && (
        <div className="feed-track-card" onClick={() => onPlay && onPlay(target.id)}>
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
        <div className="feed-track-card">
          <div className="feed-track-art" style={target.coverUrl
            ? { backgroundImage: `url('${target.coverUrl}')` }
            : { background: gradientFor(hashHue(target.title)) }
          }>
            <div className="feed-track-play">
              <ListMusic size={16} />
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
    </motion.div>
  );
}

export default function SocialFeedPage({ session, onPlay, current, isPlaying, onOpenArtist }) {
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
              onPlay={(trackId) => {
                // Find track in loaded tracks and play it
                if (onPlay) onPlay([], 0, trackId);
              }}
              onOpenArtist={onOpenArtist}
              current={current}
              isPlaying={isPlaying}
              session={session}
              onFollowUser={handleFollowUser}
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
