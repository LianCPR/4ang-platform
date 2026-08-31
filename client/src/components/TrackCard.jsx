import { useState, useRef, useEffect, memo, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, MessageCircle, Share2, Bookmark, Play, Pause, MoreHorizontal, AlignLeft, Flag, ChevronLeft, ListPlus } from "lucide-react";
import { gradientFor, hashHue, formatDate, timeAgo, formatCount } from "../lib/format";
import { cardVariants, tapScale } from "../lib/motion";
import { api } from "../api";
import ArtistBadge from "./ArtistBadge";

const REPORT_REASONS = [
  { value: "copyright", label: "Vi phạm bản quyền" },
  { value: "metadata", label: "Sai thông tin bài hát" },
  { value: "inappropriate", label: "Nội dung không phù hợp" },
  { value: "spam", label: "Spam" },
];

export default memo(function TrackCard({
  track, session, isCurrent, isPlaying, index = 0, progress,
  onPlay, onLike, onSave, onShare, onComment, onLyrics, onAddToPlaylist, onOpenArtist,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportStep, setReportStep] = useState(null); // null | "reason" | "sent"
  const [menuPos, setMenuPos] = useState(null);
  const triggerRef = useRef(null);
  const portalMenuRef = useRef(null);

  // The dropdown renders through a portal to <body> (position: fixed,
  // placed from the trigger's real viewport coordinates) rather than as a
  // CSS-absolute child of the card. Home rails scroll horizontally via
  // `overflow-x: auto` on .rail-track, which clips any absolutely-
  // positioned child that extends past the card's own box — so a menu
  // nested in the card was invisible/unreachable at the very moment a
  // rail had more than a couple of items. Escaping to a portal is what
  // actually keeps the menu (and the new Report action) reachable.
  useEffect(() => {
    if (!menuOpen || !triggerRef.current) return;
    function place() {
      const r = triggerRef.current.getBoundingClientRect();
      setMenuPos({ right: window.innerWidth - r.right, bottom: window.innerHeight - r.top + 8 });
    }
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    function onOutside(e) {
      const insideTrigger = triggerRef.current && triggerRef.current.contains(e.target);
      const insideMenu = portalMenuRef.current && portalMenuRef.current.contains(e.target);
      if (!insideTrigger && !insideMenu) setMenuOpen(false);
    }
    function onEscape(e) { if (e.key === "Escape") setMenuOpen(false); }
    document.addEventListener("pointerdown", onOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("pointerdown", onOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, [menuOpen]);

  function closeMenu() {
    setMenuOpen(false);
    setTimeout(() => setReportStep(null), 200); // wait for the close transition before resetting content
  }

  async function submitReport(reason) {
    try {
      await api.reportContent({ targetType: "track", targetId: track.id, reason });
      setReportStep("sent");
      setTimeout(closeMenu, 1400);
    } catch (e) {
      setReportStep(null);
    }
  }

  const hue = useMemo(() => hashHue(track.title), [track.title]);
  const liked = useMemo(() => track.likedBy.includes(session.username), [track.likedBy, session.username]);
  const saved = useMemo(() => track.savedBy.includes(session.username), [track.savedBy, session.username]);
  const pct = isCurrent && progress && progress.dur ? Math.min(100, (progress.cur / progress.dur) * 100) : 0;

  return (
    <motion.div className="track-card" variants={cardVariants(index)} initial="initial" animate="animate">
      <motion.div
        className="track-art"
        style={track.coverUrl ? { backgroundImage: "url('" + track.coverUrl + "')" } : { background: gradientFor(hue) }}
        onClick={onPlay}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      >
        <span className="track-art-overlay">
          <span className="track-art-play">{isCurrent && isPlaying ? <Pause size={20} /> : <Play size={20} />}</span>
        </span>
        {isCurrent && <span className="track-art-progress" style={{ width: pct + "%" }} />}
      </motion.div>

      <div className="track-info">
        <div className="track-title">{track.title}</div>
        <div className="track-artist">
          {onOpenArtist && track.uploaderUsername ? (
            <span className="artist-link" onClick={(e) => { e.stopPropagation(); onOpenArtist(track.uploaderUsername); }}>
              {track.primaryArtistName || track.composer || track.uploaderDisplayName}
            </span>
          ) : (
            <span>{track.primaryArtistName || track.composer || track.uploaderDisplayName}</span>
          )}
          {!track.composer && <ArtistBadge badge={track.uploaderBadge} size={11} />}
        </div>
      </div>

      <div className="track-quick-actions">
        <motion.button
          type="button"
          className={"action-btn" + (liked ? " active active-wine" : "")}
          onClick={onLike}
          whileTap={tapScale}
          aria-label="Thả tym"
        >
          <Heart size={16} fill={liked ? "currentColor" : "none"} />
          <span>{formatCount(track.likedBy.length)}</span>
        </motion.button>
        <motion.button
          type="button"
          className={"action-btn" + (saved ? " active active-gold" : "")}
          onClick={onSave}
          whileTap={tapScale}
          aria-label="Lưu bài hát"
        >
          <Bookmark size={16} fill={saved ? "currentColor" : "none"} />
        </motion.button>
        <div className="track-more">
          <motion.button
            ref={triggerRef}
            type="button"
            className="action-btn"
            onClick={() => setMenuOpen((v) => !v)}
            whileTap={tapScale}
            aria-label="Thêm tùy chọn"
            aria-expanded={menuOpen}
          >
            <MoreHorizontal size={16} />
          </motion.button>
          {createPortal(
            <AnimatePresence>
              {menuOpen && menuPos && (
                <motion.div
                  ref={portalMenuRef}
                  className="track-menu glass-strong track-menu-portal"
                  style={{ right: menuPos.right, bottom: menuPos.bottom }}
                  initial={{ opacity: 0, y: 6, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.97 }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                >
                  {reportStep === "reason" ? (
                    <>
                      <button type="button" className="track-menu-item" onClick={() => setReportStep(null)}>
                        <ChevronLeft size={16} /> Quay lại
                      </button>
                      <div className="track-menu-head"><div className="track-menu-title">Báo cáo bài hát này vì lý do gì?</div></div>
                      {REPORT_REASONS.map((r) => (
                        <button type="button" className="track-menu-item" key={r.value} onClick={() => submitReport(r.value)}>
                          {r.label}
                        </button>
                      ))}
                    </>
                  ) : reportStep === "sent" ? (
                    <div className="track-menu-head"><div className="track-menu-title">Đã gửi báo cáo — cảm ơn bạn.</div></div>
                  ) : (
                    <>
                      <div className="track-menu-head">
                        <div className="track-menu-title">{track.title}</div>
                        <div className="track-menu-meta">
                          {track.composer ? "Sáng tác: " + track.composer + " · " : ""}
                          Phát hành {formatDate(track.releaseDate)}
                        </div>
                        <div className="track-menu-meta">{track.uploaderDisplayName} · {timeAgo(track.createdAt)}</div>
                        {track.description && <p className="track-menu-desc">{track.description}</p>}
                      </div>
                      {onAddToPlaylist && (
                        <button type="button" className="track-menu-item" onClick={() => { setMenuOpen(false); onAddToPlaylist(track.id); }}>
                          <ListPlus size={16} /> Thêm vào playlist
                        </button>
                      )}
                      <button type="button" className="track-menu-item" onClick={() => { setMenuOpen(false); onComment(); }}>
                        <MessageCircle size={16} /> Bình luận <span className="track-menu-count">{formatCount(track.comments.length)}</span>
                      </button>
                      <button type="button" className="track-menu-item" onClick={() => { setMenuOpen(false); onLyrics(); }}>
                        <AlignLeft size={16} /> Lời bài hát
                      </button>
                      <button type="button" className="track-menu-item" onClick={() => { setMenuOpen(false); onShare(); }}>
                        <Share2 size={16} /> Chia sẻ <span className="track-menu-count">{formatCount(track.shareCount || 0)}</span>
                      </button>
                      <button type="button" className="track-menu-item track-menu-item-danger" onClick={() => setReportStep("reason")}>
                        <Flag size={16} /> Báo cáo
                      </button>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>,
            document.body
          )}
        </div>
      </div>
    </motion.div>
  );
})
