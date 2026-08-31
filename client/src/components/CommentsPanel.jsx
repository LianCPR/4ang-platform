import { motion } from "framer-motion";
import { Send } from "lucide-react";
import { gradientFor, hashHue, initials, timeAgo } from "../lib/format";

export default function CommentsPanel({ track, draft, onDraftChange, onSubmit }) {
  const comments = track ? track.comments : [];
  return (
    <>
      <h2 id="comments-title" className="sheet-title">Bình luận</h2>
      <div className="comments-list">
        {comments.map((c, i) => (
          <motion.div
            className="comment-item"
            key={c.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: Math.min(i * 0.03, 0.2) }}
          >
            <div className="avatar avatar-sm" style={{ background: gradientFor(hashHue(c.displayName)) }}>{initials(c.displayName)}</div>
            <div>
              <div className="comment-bubble"><strong>{c.displayName}</strong><div>{c.text}</div></div>
              <div className="comment-time">{timeAgo(c.createdAt)}</div>
            </div>
          </motion.div>
        ))}
        {comments.length === 0 && <p className="sub">Chưa có bình luận nào.</p>}
      </div>
      <div className="comment-input-row">
        <input
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          placeholder="Viết bình luận..."
          onKeyDown={(e) => { if (e.key === "Enter") onSubmit(); }}
        />
        <motion.button type="button" className="icon-btn icon-btn-lg" onClick={onSubmit} whileTap={{ scale: 0.9 }}>
          <Send size={18} />
        </motion.button>
      </div>
    </>
  );
}
