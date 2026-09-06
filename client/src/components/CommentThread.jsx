import { useState, useEffect, useRef, useCallback } from "react";
import { Heart, MessageCircle, Pencil, Trash2, Check, X } from "lucide-react";
import { timeAgo, gradientFor, hashHue, formatCount } from "../lib/format";
import MentionText from "./MentionText";
import CommentComposer from "./CommentComposer";

function CommentAvatar({ comment, size = 34 }) {
  return (
    <div
      className="comment-avatar"
      style={comment.authorAvatar
        ? { backgroundImage: `url('${comment.authorAvatar}')` }
        : { background: gradientFor(hashHue(comment.authorUsername || "u")) }
      }
    >
      {!comment.authorAvatar && <span>{(comment.authorDisplayName || "U")[0]}</span>}
    </div>
  );
}

function CommentActions({ label, active, count, onClick, children }) {
  return (
    <button type="button" className={"comment-action" + (active ? " active" : "")} onClick={onClick}>
      {children}
      {count > 0 && <span className="comment-action-count">{formatCount(count)}</span>}
      {label && <span className="comment-action-label">{label}</span>}
    </button>
  );
}

function CommentCard({ comment, session, onEdit, onDelete, onReact, onReply, onOpenUser, isReply, editing, onStartEdit, onCancelEdit }) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [busy, setBusy] = useState(false);

  const canManage = session && (comment.isAuthor || session.isAdmin);
  const deleted = comment.isDeleted;

  function handleEditSubmit(text) {
    setBusy(true);
    return onEdit(comment.id, text).finally(() => setBusy(false));
  }

  function handleReplySubmit(text) {
    setBusy(true);
    return onReply(comment.id, text)
      .finally(() => setBusy(false))
      .then((ok) => { if (ok !== false) setReplyOpen(false); });
  }

  return (
    <div className={"comment-card" + (editing ? " editing" : "")}>
      <CommentAvatar comment={comment} size={isReply ? 30 : 34} />

      <div className="comment-card-body">
        <div className="comment-card-meta">
          <span className="comment-card-name">{comment.authorDisplayName}</span>
          <span className="comment-card-user">@{comment.authorUsername}</span>
          <span className="comment-card-time">{timeAgo(comment.createdAt)}</span>
          {comment.edited && <span className="comment-card-edited">đã sửa</span>}
        </div>

        {editing ? (
          <div className="comment-edit-form">
            <textarea
              className="comment-composer-input"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              maxLength={500}
              rows={2}
              autoFocus
            />
            <div className="comment-edit-actions">
              <button type="button" className="btn-secondary btn-sm" onClick={onCancelEdit}>
                <X size={12} /> Huỷ
              </button>
              <button
                type="button"
                className="btn-primary btn-sm"
                disabled={!editValue.trim() || busy}
                onClick={() => editValue.trim() && handleEditSubmit(editValue.trim())}
              >
                <Check size={12} /> Lưu
              </button>
            </div>
          </div>
        ) : (
          <div className="comment-card-content">
            {deleted ? (
              <span className="comment-deleted">Bình luận đã bị xoá.</span>
            ) : (
              <MentionText text={comment.text} onOpenUser={onOpenUser} />
            )}
          </div>
        )}

        {!deleted && !editing && (
          <div className="comment-card-actions">
            <CommentActions
              active={comment.reacted}
              count={comment.likeCount}
              onClick={() => onReact(comment.id)}
            >
              <Heart size={14} fill={comment.reacted ? "currentColor" : "none"} />
            </CommentActions>

            <CommentActions
              active={false}
              count={isReply ? 0 : comment.replyCount}
              onClick={() => setReplyOpen((v) => !v)}
              label="Trả lời"
            >
              <MessageCircle size={14} />
            </CommentActions>

            {canManage && comment.isAuthor && (
              <button type="button" className="comment-action" onClick={() => { setEditValue(comment.text || ""); onStartEdit(); }}>
                <Pencil size={14} />
                <span className="comment-action-label">Sửa</span>
              </button>
            )}
            {comment.isAuthor && (
              <button type="button" className="comment-action comment-action-danger" onClick={() => onDelete(comment.id)}>
                <Trash2 size={14} />
                <span className="comment-action-label">Xoá</span>
              </button>
            )}
            {canManage && !comment.isAuthor && (
              <button type="button" className="comment-action comment-action-danger" onClick={() => onDelete(comment.id)}>
                <Trash2 size={14} />
                <span className="comment-action-label">Xoá</span>
              </button>
            )}
          </div>
        )}

        {replyOpen && (
          <div className="comment-reply-composer">
            <CommentComposer
              onSubmit={handleReplySubmit}
              placeholder="Trả lời bình luận này..."
              buttonLabel="Trả lời"
              autoFocus
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function CommentThread({ comments, session, onReply, onEdit, onDelete, onReact, onOpenUser, highlightId, loading }) {
  const [editingId, setEditingId] = useState(null);
  const highlightRef = useRef(null);

  useEffect(() => {
    if (highlightId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      const timer = setTimeout(() => highlightRef.current?.classList.add("flash"), 50);
      const clearTimer = setTimeout(() => highlightRef.current?.classList.remove("flash"), 2600);
      return () => { clearTimeout(timer); clearTimeout(clearTimer); };
    }
  }, [highlightId]);

  const handleEdit = useCallback(async (id, text) => {
    await onEdit(id, text);
    setEditingId(null);
  }, [onEdit]);

  return (
    <div className="comment-thread">
      {loading && (
        <div className="comment-skeletons">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="comment-skeleton" style={{ animationDelay: `${i * 0.08}s` }} />
          ))}
        </div>
      )}

      {!loading && comments.length === 0 && (
        <p className="comment-empty">Chưa có bình luận nào. Hãy là người đầu tiên!</p>
      )}

      {comments.map((c) => (
        <div key={c.id} className="comment-row">
          <div ref={highlightId === c.id ? highlightRef : undefined} className="comment-highlight-wrap">
            <CommentCard
              comment={c}
              session={session}
              isReply={false}
              editing={editingId === c.id}
              onStartEdit={() => setEditingId(c.id)}
              onCancelEdit={() => setEditingId(null)}
              onEdit={handleEdit}
              onDelete={onDelete}
              onReact={onReact}
              onReply={onReply}
              onOpenUser={onOpenUser}
            />
          </div>

          {c.replies.length > 0 && (
            <div className="comment-replies">
              {c.replies.map((r) => (
                <div key={r.id} ref={highlightId === r.id ? highlightRef : undefined} className="comment-highlight-wrap">
                  <CommentCard
                    comment={r}
                    session={session}
                    isReply
                    editing={editingId === r.id}
                    onStartEdit={() => setEditingId(r.id)}
                    onCancelEdit={() => setEditingId(null)}
                    onEdit={handleEdit}
                    onDelete={onDelete}
                    onReact={onReact}
                    onReply={onReply}
                    onOpenUser={onOpenUser}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}