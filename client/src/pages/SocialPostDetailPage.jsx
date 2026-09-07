import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { Heart, Music, ListMusic, Play, MessageCircle, ArrowLeft, UserPlus, Radio } from "lucide-react";
import { api } from "../api";
import { gradientFor, hashHue, timeAgo, formatCount } from "../lib/format";
import { ACTIVITY_CONFIG } from "../lib/activity";
import ArtistBadge from "../components/ArtistBadge";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import CommentThread from "../components/CommentThread";
import CommentComposer from "../components/CommentComposer";

// Reusable target card rendering for a social post.
function PostTarget({ target, onPlay, onOpenArtist, session, onFollowUser, className = "" }) {
  if (!target) return null;
  if (target.type === "track") {
    return (
      <div className="feed-track-card" onClick={() => onPlay && onPlay(target.id)}>
        <div className="feed-track-art" style={target.coverUrl
          ? { backgroundImage: `url('${target.coverUrl}')` }
          : { background: gradientFor(hashHue(target.title)) }
        }>
          <div className="feed-track-play"><Play size={16} fill="white" /></div>
        </div>
        <div className="feed-track-info">
          <div className="feed-track-title">{target.title}</div>
          <div className="feed-track-artist">{target.artist}</div>
        </div>
      </div>
    );
  }
  if (target.type === "playlist") {
    return (
      <div className="feed-track-card">
        <div className="feed-track-art" style={target.coverUrl
          ? { backgroundImage: `url('${target.coverUrl}')` }
          : { background: gradientFor(hashHue(target.title)) }
        }>
          <div className="feed-track-play"><ListMusic size={16} /></div>
        </div>
        <div className="feed-track-info">
          <div className="feed-track-title">{target.title}</div>
          <div className="feed-track-artist">{target.trackCount} bài hát</div>
        </div>
      </div>
    );
  }
  if (target.type === "release") {
    return (
      <div className="feed-track-card">
        <div className="feed-track-art" style={target.coverUrl
          ? { backgroundImage: `url('${target.coverUrl}')` }
          : { background: gradientFor(hashHue(target.title)) }
        }>
          <Music size={16} style={{ color: "white", position: "absolute" }} />
        </div>
        <div className="feed-track-info">
          <div className="feed-track-title">{target.title}</div>
          <div className="feed-track-artist">{(target.releaseType || "Phát hành")}{target.trackCount ? ` • ${target.trackCount} bài` : ""}</div>
        </div>
      </div>
    );
  }
  if (target.type === "artist") {
    return (
      <div className="feed-track-card" onClick={() => onOpenArtist && onOpenArtist(target.username)}>
        <div className="feed-track-art" style={{ background: gradientFor(hashHue(target.username)), borderRadius: "50%" }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "white" }}>{(target.name || "A")[0]}</span>
        </div>
        <div className="feed-track-info">
          <div className="feed-track-title">{target.name}</div>
          <div className="feed-track-artist">Nghệ sĩ</div>
        </div>
      </div>
    );
  }
  if (target.type === "room") {
    return (
      <div className={"feed-track-card room-card-lite" + className}>
        <div className="feed-track-art" style={{ background: gradientFor(hashHue(target.name)) }}>
          <Radio size={16} style={{ color: "white" }} />
        </div>
        <div className="feed-track-info">
          <div className="feed-track-title">{target.name}</div>
          <div className="feed-track-artist">{target.participantCount} người đang nghe</div>
        </div>
      </div>
    );
  }
  return null;
}

export default function SocialPostDetailPage({
  postId, session, commentId, onBack, onPlay, onOpenArtist, kind = "auto",
}) {
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [resolvedKind, setResolvedKind] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [openedWithMore, setOpenedWithMore] = useState(false);

  // Prefer the prop (from App); fall back to ?comment= URL param.
  const effectiveCommentId = commentId ?? new URLSearchParams(window.location.search).get("comment");
  const consumedRef = useRef(false);

  // If a deep-linked comment id came from the URL, we load comments and let
  // the thread highlight + scroll to it.
  const highlightCommentId = effectiveCommentId && !consumedRef.current ? effectiveCommentId : null;

  const loadPost = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    try {
      let res;
      if (kind === "artist_post") {
        res = await api.artistPostDetail(id);
        setResolvedKind("artist_post");
      } else if (kind === "post") {
        res = await api.postDetail(id);
        setResolvedKind("post");
      } else {
        try {
          res = await api.postDetail(id);
          setResolvedKind("post");
        } catch {
          res = await api.artistPostDetail(id);
          setResolvedKind("artist_post");
        }
      }
      setPost(res.post || null);
    } catch (e) {
      setError(e.message || "Không thể tải bài đăng.");
    }
    setLoading(false);
  }, [kind]);

  // Comments on artist posts use the shared "artist_post" target (Phase 2.1).
  const targetType = resolvedKind === "artist_post" ? "artist_post" : "post";

  const loadComments = useCallback(async (id, highlightId) => {
    if (!id) return;
    setCommentsLoading(true);
    try {
      const res = await api.listComments(targetType, id, { limit: 30 });
      setComments(res.comments || []);
      // Determine if the highlighted comment is loaded (post body or reply)
      setTimeout(() => {
        const visible = (res.comments || []).some((c) => c.id === highlightId)
          || (res.comments || []).some((c) => c.replies.some((r) => r.id === highlightId));
        if (!visible) consumedRef.current = true; // stop highlighting if not found
      }, 0);
    } catch { /* keep empty */ }
    setCommentsLoading(false);
  }, [targetType]);

  useEffect(() => {
    if (!postId) return;
    setComments([]);
    setOpenedWithMore(false);
    consumedRef.current = false;
    loadPost(postId);
    loadComments(postId, effectiveCommentId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  // Record a view once when an artist post detail is opened (Phase 2.4)
  useEffect(() => {
    if (post && resolvedKind === "artist_post") {
      api.viewArtistPost(post.id).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post?.id, resolvedKind]);

  const handleCreate = async (text) => {
    if (!post) return false;
    try {
      const res = await api.createComment(targetType, post.id, text, null);
      const created = {
        id: res.id,
        targetType, targetId: post.id, parentId: null,
        authorUsername: session.username, authorDisplayName: session.username,
        authorAvatar: null, isAuthor: true,
        text, isDeleted: false, edited: false,
        createdAt: Date.now(), likeCount: 0, replyCount: 0, reacted: false, replies: [],
      };
      setComments((prev) => [created, ...prev]);
      setPost((p) => (p ? { ...p, commentCount: (p.commentCount || 0) + 1 } : p));
      return true;
    } catch (e) {
      setError(e.message || "Không thể gửi bình luận.");
      return false;
    }
  };

  const handleReply = async (parentId, text) => {
    if (!post) return false;
    try {
      const res = await api.createComment(targetType, post.id, text, parentId);
      const created = {
        id: res.id, targetType, targetId: post.id, parentId,
        authorUsername: session.username, authorDisplayName: session.username,
        authorAvatar: null, isAuthor: true,
        text, isDeleted: false, edited: false,
        createdAt: Date.now(), likeCount: 0, replyCount: 0, reacted: false, replies: [],
      };
      setComments((prev) => prev.map((c) => c.id === parentId
        ? { ...c, replies: [...c.replies, created], replyCount: (c.replyCount || 0) + 1 }
        : c));
      return true;
    } catch (e) {
      setError(e.message || "Không thể trả lời.");
      return false;
    }
  };

  const handleEdit = async (id, text) => {
    try {
      await api.editComment(id, text);
      const editNode = (c) => c.id === id ? { ...c, text, edited: true } : c;
      setComments((prev) => prev.map((c) => ({ ...editNode(c), replies: (c.replies || []).map(editNode) })));
      return true;
    } catch (e) {
      setError(e.message || "Không thể sửa bình luận.");
      return false;
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteComment(id);
      let removed = false;
      setComments((prev) => {
        const out = [];
        for (const c of prev) {
          if (c.id === id) { removed = true; continue; }
          if (c.replies && c.replies.some((r) => r.id === id)) {
            out.push({ ...c, replies: c.replies.filter((r) => r.id !== id), replyCount: Math.max(0, (c.replyCount || 0) - 1) });
          } else out.push(c);
        }
        return out;
      });
      if (removed) setPost((p) => (p ? { ...p, commentCount: Math.max(0, (p.commentCount || 0) - 1) } : p));
      return true;
    } catch (e) {
      setError(e.message || "Không thể xoá bình luận.");
      return false;
    }
  };

  const handleReact = async (id) => {
    const flip = (c) => c.id === id
      ? { ...c, reacted: !c.reacted, likeCount: (c.likeCount || 0) + (c.reacted ? -1 : 1) }
      : { ...c, replies: (c.replies || []).map(flip) };
    setComments((prev) => prev.map(flip));
    try {
      await api.reactComment(id);
    } catch (e) {
      setComments((prev) => prev.map(flip));
      setError(e.message || "Không thể thả tym.");
    }
  };

  const handlePostReact = async () => {
    if (!post) return;
    const was = post.reacted;
    setPost((p) => ({ ...p, reacted: !was, likeCount: (p.likeCount || 0) + (was ? -1 : 1) }));
    try {
      const res = resolvedKind === "artist_post"
        ? await api.reactArtistPost(post.id)
        : await api.reactPost(post.id);
      setPost((p) => ({ ...p, reacted: res.reacted, likeCount: res.likeCount }));
    } catch (e) {
      setPost((p) => ({ ...p, reacted: was, likeCount: (p.likeCount || 0) + (was ? 1 : -1) }));
    }
  };

  if (loading) {
    return (
      <div className="feed-page">
        <div className="feed-header">
          <button type="button" className="icon-btn" onClick={onBack} aria-label="Quay lại"><ArrowLeft size={18} /></button>
        </div>
        <div className="feed-list">
          {Array.from({ length: 2 }).map((_, i) => (
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

  if (error || !post) {
    return (
      <div className="feed-page">
        <div className="feed-header">
          <button type="button" className="icon-btn" onClick={onBack} aria-label="Quay lại"><ArrowLeft size={18} /></button>
        </div>
        <ErrorState message={error || "Không tìm thấy bài đăng."} onRetry={() => { setError(null); loadPost(postId); }} />
      </div>
    );
  }

  const config = ACTIVITY_CONFIG[post.eventType] || { icon: MessageCircle, color: "var(--text-muted)", verb: "đã tương tác" };
  const Icon = config.icon;
  const ownerName = post.artistUsername || post.username;
  const ownerStyle = post.avatarUrl
    ? { backgroundImage: `url('${post.avatarUrl}')` }
    : { background: gradientFor(hashHue(ownerName)) };

  return (
    <div className="feed-page post-detail-page">
      <div className="feed-header">
        <button type="button" className="icon-btn" onClick={onBack} aria-label="Quay lại"><ArrowLeft size={18} /></button>
      </div>

      <motion.div className="feed-item" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
        <div className="feed-item-header">
          <button type="button" className="feed-avatar" style={ownerStyle} onClick={() => onOpenArtist && onOpenArtist(ownerName)}>
            {!post.avatarUrl && <span style={{ fontSize: 12, fontWeight: 600 }}>{(post.displayName || "U")[0]}</span>}
          </button>
          <div className="feed-user-info">
            <span className="feed-username">{post.displayName}</span>
            <span className="feed-activity-text"><Icon size={13} style={{ color: config.color }} /> {config.verb}</span>
          </div>
          <span className="feed-time">{timeAgo(post.createdAt)}</span>
        </div>

        {post.message && <p className="feed-message">{post.message}</p>}
        <PostTarget target={post.target} onPlay={onPlay} onOpenArtist={onOpenArtist} session={session} />

        <div className="feed-item-stats">
          <span>{formatCount(post.likeCount || 0)} tym</span>
          <span>{formatCount(post.commentCount || 0)} bình luận</span>
        </div>

        <div className="feed-item-actions">
          <button type="button" className={"feed-action-btn" + (post.reacted ? " active" : "")} onClick={handlePostReact}>
            <Heart size={16} fill={post.reacted ? "currentColor" : "none"} />
            <span>Tym</span>
          </button>
          <button type="button" className="feed-action-btn" onClick={() => document.getElementById("post-comments-top")?.scrollIntoView({ behavior: "smooth" })}>
            <MessageCircle size={16} />
            <span>Bình luận</span>
          </button>
        </div>
      </motion.div>

      <div id="post-comments-top" className="post-comments-section">
        <div className="post-comments-title">Bình luận ({formatCount(post.commentCount || 0)})</div>
        <CommentComposer onSubmit={handleCreate} placeholder="Viết bình luận..." buttonLabel="Gửi" />
        <CommentThread
          comments={comments}
          session={session}
          onReply={handleReply}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onReact={handleReact}
          onOpenUser={onOpenArtist}
          highlightId={highlightCommentId}
          loading={commentsLoading}
        />
      </div>
    </div>
  );
}