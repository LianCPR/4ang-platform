import { useState, useEffect } from "react";
import { X, Copy, Check, Music, Disc3, ListMusic, User, Share2 } from "lucide-react";

const TYPE_ICONS = { track: Music, album: Disc3, playlist: ListMusic, artist: User };
const TYPE_LABELS = { track: "Bài hát", album: "Album", playlist: "Playlist", artist: "Nghệ sĩ" };

function generateShareUrl(type, id) {
  const base = window.location.origin;
  switch (type) {
    case "track": return base + "/?play=" + id;
    case "album": return base + "/?album=" + id;
    case "playlist": return base + "/?playlist=" + id;
    case "artist": return base + "/?artist=" + (id || "");
    default: return base;
  }
}

function generateShareText(type, title, artist) {
  const suffix = artist ? ` — ${artist}` : "";
  switch (type) {
    case "track": return `Nghe "${title}"${suffix} trên 4ANG`;
    case "album": return `Khám phá album "${title}"${suffix} trên 4ANG`;
    case "playlist": return `Playlist "${title}" trên 4ANG`;
    case "artist": return `Khám phá nghệ sĩ "${title}" trên 4ANG`;
    default: return `Xem trên 4ANG`;
  }
}

export default function ShareSheet({ open, onClose, type = "track", id, title, artist, coverUrl, onShareComplete }) {
  const [copied, setCopied] = useState(false);
  const url = generateShareUrl(type, id);
  const shareText = generateShareText(type, title, artist);
  const Icon = TYPE_ICONS[type] || Music;

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  useEffect(() => {
    if (open) setCopied(false);
  }, [open]);

  if (!open) return null;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      const input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
    }
  }

  async function handleNativeShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title: shareText, text: shareText, url });
        onShareComplete?.();
        onClose();
      } catch (e) {
        if (e.name !== "AbortError") console.error(e);
      }
    }
  }

  async function handleCopyText() {
    const text = shareText + "\n" + url;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {}
  }

  return (
    <div className="share-overlay" onClick={onClose}>
      <div className="share-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="share-header">
          <div className="share-type-label">
            <Icon size={14} />
            <span>Chia sẻ {TYPE_LABELS[type]}</span>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Đóng">
            <X size={18} />
          </button>
        </div>

        <div className="share-preview">
          {coverUrl ? (
            <div className="share-preview-art" style={{ backgroundImage: `url(${coverUrl})` }} />
          ) : (
            <div className="share-preview-art share-preview-art-fallback">
              <Icon size={24} style={{ color: "var(--text-faint)" }} />
            </div>
          )}
          <div className="share-preview-info">
            <div className="share-preview-title">{title}</div>
            {artist && <div className="share-preview-artist">{artist}</div>}
            <div className="share-preview-url">{url}</div>
          </div>
        </div>

        <div className="share-actions">
          <button type="button" className="share-action-btn" onClick={handleCopy}>
            <div className="share-action-icon">
              {copied ? <Check size={20} style={{ color: "var(--c-sage-deep)" }} /> : <Copy size={20} />}
            </div>
            <span>{copied ? "Đã copy!" : "Copy link"}</span>
          </button>

          <button type="button" className="share-action-btn" onClick={handleCopyText}>
            <div className="share-action-icon">
              <Music size={20} />
            </div>
            <span>Copy text</span>
          </button>

          {typeof navigator !== "undefined" && navigator.share && (
            <button type="button" className="share-action-btn" onClick={handleNativeShare}>
              <div className="share-action-icon">
                <Share2 size={20} />
              </div>
              <span>Chia sẻ</span>
            </button>
          )}
        </div>

        <button type="button" className={"share-copy-btn" + (copied ? " copied" : "")} onClick={handleCopy}>
          {copied ? <Check size={16} /> : <Copy size={16} />}
          <span>{copied ? "Đã copy link!" : "Copy link chia sẻ"}</span>
        </button>
      </div>
    </div>
  );
}
