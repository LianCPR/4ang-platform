import { useRef, useState, useEffect, useCallback } from "react";
import { Send, AtSign } from "lucide-react";
import { api } from "../api";
import { gradientFor, hashHue } from "../lib/format";

let searchSeq = 0;

// Debounced mention search with request sequencing so stale results don't
// overwrite fresh ones.
export default function CommentComposer({ onSubmit, placeholder, buttonLabel, autoFocus }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [mentions, setMentions] = useState([]);
  const [mentionQuery, setMentionQuery] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const searchTimer = useRef(null);

  // Track the token currently being typed (right after @) so autocomplete
  // only triggers mid-token.
  const currentToken = useCallback((text, caret) => {
    const before = text.slice(0, caret);
    const m = before.match(/@([A-Za-z0-9_.]*)$/);
    if (!m) return null;
    // Only trigger when not preceded by another word char e.g. email
    const atIdx = before.lastIndexOf("@");
    const prev = atIdx > 0 ? before[atIdx - 1] : null;
    if (prev && /[A-Za-z0-9_]/.test(prev)) return null;
    return { token: m[1].toLowerCase(), start: atIdx, end: caret };
  }, []);

  const runSearch = useCallback(async (query) => {
    const seq = ++searchSeq;
    try {
      const res = await api.mentionSearch(query);
      if (seq !== searchSeq) return; // stale
      setMentions(res.users || []);
      setActiveIndex(0);
    } catch {
      if (seq === searchSeq) setMentions([]);
    }
  }, []);

  const handleChange = (e) => {
    const text = e.target.value;
    setValue(text);
    const caret = e.target.selectionStart;
    const tok = currentToken(text, caret);
    if (tok) {
      setMentionQuery(tok);
      clearTimeout(searchTimer.current);
      const q = tok.token;
      if (q.length >= 1) {
        searchTimer.current = setTimeout(() => runSearch(q), 180);
      } else {
        setMentions([]);
      }
    } else {
      setMentionQuery(null);
      setMentions([]);
      clearTimeout(searchTimer.current);
    }
  };

  const applyMention = (username) => {
    setMentions([]);
    setMentionQuery(null);
    clearTimeout(searchTimer.current);
    setValue((prev) => {
      if (!mentionQuery) return prev;
      const next = prev.slice(0, mentionQuery.start) + "@" + username + " " + prev.slice(mentionQuery.end);
      // refocus after state settles
      requestAnimationFrame(() => {
        const el = inputRef.current;
        if (el) {
          el.focus();
          el.setSelectionRange(next.length, next.length);
        }
      });
      return next;
    });
  };

  const handleKeyDown = (e) => {
    if (mentions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % mentions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + mentions.length) % mentions.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        if (mentionQuery) {
          e.preventDefault();
          applyMention(mentions[activeIndex]?.username);
          return;
        }
      }
      if (e.key === "Escape") {
        setMentions([]);
        setMentionQuery(null);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    const text = value.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      const ok = await onSubmit(text);
      if (ok !== false) {
        setValue("");
        setMentions([]);
        setMentionQuery(null);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="comment-composer">
      <div className="comment-composer-inner">
        <textarea
          ref={inputRef}
          className="comment-composer-input"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || "Viết bình luận... (gõ @ để nhắc)"}
          autoFocus={autoFocus}
          rows={Math.max(1, Math.min(4, value.split("\n").length))}
          maxLength={500}
        />
        <button
          type="button"
          className={"comment-send-btn" + (value.trim() || busy ? " active" : "")}
          onClick={handleSubmit}
          disabled={!value.trim() || busy}
          aria-label={buttonLabel || "Gửi"}
        >
          <Send size={16} />
        </button>
      </div>

      {mentions.length > 0 && mentionQuery && (
        <div className="mention-suggestions">
          {mentions.map((u, i) => (
            <button
              type="button"
              key={u.username}
              className={"mention-suggestion" + (i === activeIndex ? " active" : "")}
              onMouseEnter={() => setActiveIndex(i)}
              onClick={() => applyMention(u.username)}
            >
              <div className="mention-suggestion-avatar" style={u.avatarUrl
                ? { backgroundImage: `url('${u.avatarUrl}')` }
                : { background: gradientFor(hashHue(u.username)) }
              }>
                {!u.avatarUrl && <span>{(u.displayName || "U")[0]}</span>}
              </div>
              <div className="mention-suggestion-info">
                <span className="mention-suggestion-name">{u.displayName}</span>
                <span className="mention-suggestion-user">@{u.username}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}