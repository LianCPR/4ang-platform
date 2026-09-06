import { useState, useEffect, useCallback, useRef } from "react";
import { MessageCircle, ListMusic, Disc3, Music, User } from "lucide-react";
import { api } from "../api";
import CommentThread from "./CommentThread";
import CommentComposer from "./CommentComposer";

const TARGET_ICONS = { track: Music, playlist: ListMusic, album: Disc3, post: MessageCircle, user: User };
const TARGET_LABELS = { track: "Âm nhạc", playlist: "Playlist", album: "Album", post: "Bài đăng", user: "Hồ sơ" };

// Full-screen comment sheet for any target entity (track, playlist, album,
// post). Uses the unified /api/comments endpoints.
export default function CommentsSheet({
  open, targetType, targetId, title, subtitle, coverUrl,
  session, onOpenUser, pendingCommentId, onPendingCommentConsumed,
}) {
  const [comments, setComments] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [nextBefore, setNextBefore] = useState(null);
  const [busy, setBusy] = useState(false);
  const submitRef = useRef(null);

  const Icon = targetType ? (TARGET_ICONS[targetType] || MessageCircle) : MessageCircle;
  const label = targetType ? (TARGET_LABELS[targetType] || "Đối tượng") : "";

  const loadInitial = useCallback(async (highlightId) => {
    if (!open || (!targetType && !targetId)) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.listComments(targetType, targetId, { limit: 30 });
      setComments(res.comments || []);
      setTotal(res.total || 0);
      setNextBefore(res.comments && res.comments.length > 0 ? res.comments[res.comments.length - 1].createdAt : null);
      if (highlightId) {
        // If the target comment is among the initially loaded set, let the
        // thread highlight it; otherwise flag that it isn't visible.
        setTimeout(() => {
          const found = (res.comments || []).some((c) => c.id === highlightId)
            || (res.comments || []).some((c) => c.replies.some((r) => r.id === highlightId));
          if (!found) onPendingCommentConsumed && onPendingCommentConsumed();
        }, 0);
      }
    } catch (e) {
      setError(e.message || "Không thể tải bình luận.");
    }
    setLoading(false);
  }, [open, targetType, targetId, onPendingCommentConsumed]);

  useEffect(() => {
    if (open) {
      setComments([]);
      setNextBefore(null);
      setTotal(0);
      loadInitial(pendingCommentId);
    }
  }, [open, targetType, targetId, pendingCommentId, loadInitial]);

  const submitRefCleanup = useCallback((added) => {
    // Optimistically prepend pending comments that appear after submit
    submitRef.current = added;
  }, []);

  const handleCreate = async (text) => {
    if (!targetType || !targetId || busy) return false;
    setBusy(true);
    try {
      const res = await api.createComment(targetType, targetId, text, null);
      const created = {
        id: res.id,
        targetType,
        targetId,
        parentId: null,
        authorUsername: session.username,
        authorDisplayName: session.username,
        authorAvatar: null,
        isAuthor: true,
        text,
        isDeleted: false,
        edited: false,
        createdAt: Date.now(),
        likeCount: 0,
        replyCount: 0,
        reacted: false,
        replies: [],
      };
      setComments((prev) => [created, ...prev]);
      setTotal((t) => t + 1);
      submitRefCleanup(created);
      return true;
    } catch (e) {
      setError(e.message || "Không thể gửi bình luận.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleReply = async (parentId, text) => {
    if (busy) return false;
    setBusy(true);
    try {
      const res = await api.createComment(targetType, targetId, text, parentId);
      const created = {
        id: res.id,
        targetType,
        targetId,
        parentId,
        authorUsername: session.username,
        authorDisplayName: session.username,
        authorAvatar: null,
        isAuthor: true,
        text,
        isDeleted: false,
        edited: false,
        createdAt: Date.now(),
        likeCount: 0,
        replyCount: 0,
        reacted: false,
        replies: [],
      };
      setComments((prev) => prev.map((c) => c.id === parentId
        ? { ...c, replies: [...c.replies, created], replyCount: (c.replyCount || 0) + 1 }
        : c));
      return true;
    } catch (e) {
      setError(e.message || "Không thể trả lời.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleEdit = async (id, text) => {
    try {
      await api.editComment(id, text);
      const editNode = (c) => c.id === id ? { ...c, text, edited: true } : c;
      setComments((prev) => prev.map((c) => ({
        ...editNode(c),
        replies: (c.replies || []).map(editNode),
      })));
      return true;
    } catch (e) {
      setError(e.message || "Không thể sửa bình luận.");
      return false;
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteComment(id);
      setComments((prev) => {
        let removed = false;
        const strip = (list) => {
          const out = [];
          for (const c of list) {
            if (c.id === id) { removed = true; continue; }
            if (c.replies && c.replies.some((r) => r.id === id)) {
              out.push({ ...c, replies: c.replies.filter((r) => r.id !== id), replyCount: Math.max(0, (c.replyCount || 0) - 1) });
            } else {
              out.push({ ...c, replies: c.replies ? strip(c.replies) : c.replies });
            }
          }
          return out;
        };
        const next = strip(prev);
        setTotal((t) => Math.max(0, t - (removed ? 1 : 0)));
        return next;
      });
      return true;
    } catch (e) {
      setError(e.message || "Không thể xoá bình luận.");
      return false;
    }
  };

  const handleReact = async (id) => {
    const flip = (c) => {
      if (c.id === id) return { ...c, reacted: !c.reacted, likeCount: (c.likeCount || 0) + (c.reacted ? -1 : 1) };
      return { ...c, replies: (c.replies || []).map(flip) };
    };
    setComments((prev) => prev.map(flip));
    try {
      await api.reactComment(id);
      return true;
    } catch (e) {
      setComments((prev) => prev.map(flip));
      setError(e.message || "Không thể thả tym.");
      return false;
    }
  };

  const loadMore = async () => {
    if (loadingMore || !nextBefore) return;
    setLoadingMore(true);
    try {
      const res = await api.listComments(targetType, targetId, { limit: 30, before: nextBefore });
      setComments((prev) => [...prev, ...(res.comments || [])]);
      setNextBefore(res.comments && res.comments.length > 0 ? res.comments[res.comments.length - 1].createdAt : null);
    } catch (e) {
      setError(e.message || "Không thể tải thêm bình luận.");
    }
    setLoadingMore(false);
  };

  return (
    <div className="comments-sheet">
      <div className="comments-sheet-header">
        <div className="comments-sheet-title-row">
          <div className="comments-sheet-thumb" style={coverUrl
            ? { backgroundImage: `url('${coverUrl}')` }
            : { background: "var(--surface-active)" }
          }>
            <Icon size={18} style={{ color: "var(--c-faint)" }} />
          </div>
          <div className="comments-sheet-info">
            <div className="comments-sheet-title">{title || "Bình luận"}</div>
            {subtitle && <div className="comments-sheet-subtitle">{subtitle}</div>}
          </div>
          <span className="comments-sheet-count">{formatCountSafe(total)}</span>
        </div>
        {label && <span className="comments-sheet-label">{label}</span>}
      </div>

      <div className="comments-sheet-body">
        <CommentThread
          comments={comments}
          session={session}
          onReply={handleReply}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onReact={handleReact}
          onOpenUser={onOpenUser}
          highlightId={pendingCommentId}
          loading={loading}
        />

        {error && <p className="comment-error">{error}</p>}

        {!loading && nextBefore && (
          <button type="button" className="btn-secondary btn-sm comment-load-more" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? "Đang tải..." : "Xem thêm bình luận"}
          </button>
        )}
      </div>

      <div className="comments-sheet-composer">
        <CommentComposer onSubmit={handleCreate} placeholder="Viết bình luận..." buttonLabel="Gửi" />
      </div>
    </div>
  );
}

function formatCountSafe(n) {
  if (n == null || isNaN(n)) return "0";
  return n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k" : String(n);
}