import { AtSign } from "lucide-react";

// Renders text with @mentions as tappable chips and preserves whitespace.
// Mentions are validated server-side; this is purely presentational.
export default function MentionText({ text, onOpenUser }) {
  if (!text) return null;
  const parts = String(text).split(/(^|\s)(@[A-Za-z0-9_.]{1,40})/g);
  const nodes = [];
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    if (part === undefined) break;
    if (i % 3 === 2) {
      const username = part.slice(1);
      nodes.push(
        <button
          key={i}
          type="button"
          className="mention-chip"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            if (onOpenUser) onOpenUser(username);
          }}
        >
          <AtSign size={11} />
          {username}
        </button>
      );
    } else if (part) {
      nodes.push(part);
    }
  }
  return <span className="mention-text">{nodes}</span>;
}