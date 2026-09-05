import { useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown, Play, Pause, SkipBack, SkipForward,
  Volume2, Heart, Bookmark, Share2, ListMusic,
  Shuffle, Repeat, Timer, Maximize2, Minimize2,
} from "lucide-react";
import { gradientFor, formatTime, formatDate } from "../lib/format";
import { videoSrcFor } from "../api";
import { creditRoleLabel } from "../lib/submissions";
import VinylRecord from "./VinylRecord";
import TrackRail from "./TrackRail";
import ArtistBadge from "./ArtistBadge";
import TimedLyrics from "./TimedLyrics";

export default function FullPlayer({
  session, current, isPlaying, progress, volume, queue, queueIndex,
  tracks, currentTrack,
  onClose, onToggle, onPrev, onNext, onSeek, onVolume, onOpenQueue, onOpenArtist,
  onPlay, onLike, onSave, onShare, onComment, onLyrics, onAddToPlaylist,
  shuffleEnabled, repeatMode, onToggleShuffle, onToggleRepeat,
  sleepTimer, sleepTimerRemaining, onStartSleepTimer, onClearSleepTimer,
  audioState, audioError, onRetry,
}) {
  const pct = progress.dur > 0 ? Math.round((progress.cur / progress.dur) * 1000) : 0;
  const isBuffering = audioState === "buffering" || audioState === "loading";
  const isLocal = current.source === "local";
  const [lyricsFullscreen, setLyricsFullscreen] = useState(false);
  const toggleLyricsFullscreen = useCallback(() => setLyricsFullscreen((p) => !p), []);
  const liked = isLocal && currentTrack ? currentTrack.likedBy.includes(session.username) : false;
  const saved = isLocal && currentTrack ? currentTrack.savedBy.includes(session.username) : false;

  const related = useMemo(() => {
    if (!isLocal || !currentTrack) return [];
    const pool = tracks.filter((t) => t.id !== currentTrack.id && t.status === "approved");
    const sameComposer = currentTrack.composer ? pool.filter((t) => t.composer === currentTrack.composer) : [];
    if (sameComposer.length > 0) return sameComposer.slice(0, 8);
    return pool
      .map((t) => ({ t, score: t.likedBy.length * 2 + t.shareCount * 3 + (t.playCount || 0) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((x) => x.t);
  }, [isLocal, currentTrack, tracks]);

  // Swipe down to close (mobile)
  const touchStartY = useRef(0);
  const [swipeY, setSwipeY] = useState(0);
  const handleTouchStart = useCallback((e) => { touchStartY.current = e.touches[0].clientY; }, []);
  const handleTouchMove = useCallback((e) => {
    const diff = e.touches[0].clientY - touchStartY.current;
    if (diff > 0) setSwipeY(Math.min(diff, 200));
  }, []);
  const handleTouchEnd = useCallback(() => {
    if (swipeY > 100) onClose();
    setSwipeY(0);
  }, [swipeY, onClose]);

  return (
    <>
    <motion.div
      className="np-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ transform: swipeY > 0 ? `translateY(${swipeY * 0.5}px)` : undefined }}
    >
      {/* Ambient background from artwork */}
      <div
        className="np-ambient-bg"
        style={current.thumb
          ? { backgroundImage: `url('${current.thumb}')` }
          : { background: gradientFor(current.hue) }
        }
      />

      <motion.div
        className="np-container"
        initial={{ y: 30, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 20, opacity: 0, scale: 0.99 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Close button */}
        <button type="button" className="np-close" onClick={onClose} aria-label="Đóng trình phát">
          <ChevronDown size={20} />
        </button>

        {/* ── DESKTOP: 2-column layout ── */}
        <div className="np-layout">
          {/* LEFT COLUMN — Artwork + Info */}
          <div className="np-left">
            <motion.div
              className="np-artwork-wrap"
              layoutId={current.trackId ? "player-art-" + current.trackId : undefined}
            >
              <div
                className={"np-artwork" + (isPlaying ? " playing" : "")}
                style={current.thumb
                  ? { backgroundImage: `url('${current.thumb}')` }
                  : { background: gradientFor(current.hue) }
                }
              >
                <div className="np-artwork-overlay" />
              </div>
              <VinylRecord
                artUrl={current.thumb || null}
                artHue={current.hue}
                isPlaying={isPlaying}
                size={180}
                className="np-vinyl-desktop"
              />
            </motion.div>

            {/* Song info */}
            <div className="np-song-info">
              <motion.h2
                className="np-song-title"
                layoutId={current.trackId ? "player-title-" + current.trackId : undefined}
              >
                {current.title}
              </motion.h2>
              <p className="np-song-artist">{current.artist}</p>
              {queue.length > 1 && (
                <p className="np-queue-hint">{queueIndex + 1} / {queue.length} trong hàng chờ</p>
              )}
            </div>

            {/* Action buttons */}
            <div className="np-actions">
              <motion.button
                type="button"
                className={"np-action-btn" + (liked ? " active-wine" : "")}
                onClick={() => onLike(current.trackId)}
                whileTap={{ scale: 0.9 }}
                aria-label="Thả tym"
              >
                <Heart size={18} fill={liked ? "currentColor" : "none"} />
              </motion.button>
              <motion.button
                type="button"
                className={"np-action-btn" + (saved ? " active-gold" : "")}
                onClick={() => onSave(current.trackId)}
                whileTap={{ scale: 0.9 }}
                aria-label="Lưu bài hát"
              >
                <Bookmark size={18} fill={saved ? "currentColor" : "none"} />
              </motion.button>
              <motion.button
                type="button"
                className="np-action-btn"
                onClick={() => onShare(currentTrack)}
                whileTap={{ scale: 0.9 }}
                aria-label="Chia sẻ"
              >
                <Share2 size={18} />
              </motion.button>
            </div>
          </div>

          {/* RIGHT COLUMN — Lyrics + Info */}
          <div className="np-right">
            {isLocal && currentTrack ? (
              <div className="np-lyrics-section">
                <TimedLyrics
                  timedLyrics={currentTrack.timedLyrics || null}
                  plainLyrics={currentTrack.lyrics || null}
                  currentTime={progress.cur}
                  duration={progress.dur}
                  title={current.title}
                  coverUrl={currentTrack.coverUrl}
                  artistName={currentTrack.primaryArtistName || currentTrack.uploaderDisplayName}
                  onSeek={(time) => {
                    if (onSeek) onSeek(Math.round((time / Math.max(progress.dur, 1)) * 1000));
                  }}
                  isPlaying={isPlaying}
                  onToggleFullscreen={toggleLyricsFullscreen}
                  isFullscreen={lyricsFullscreen}
                />
              </div>
            ) : (
              <div className="np-lyrics-section np-lyrics-empty">
                <p className="sub">Đang nghe từ YouTube — lời bài hát chỉ khả dụng với bài hát trên 4ANG.</p>
              </div>
            )}
          </div>
        </div>

        {/* ── BOTTOM: Controls + Progress ── */}
        <div className="np-bottom">
          {/* Progress bar */}
          <div className="np-progress-row">
            <span className="np-time">{formatTime(progress.cur)}</span>
            <input
              type="range" min="0" max="1000" value={pct}
              onChange={(e) => onSeek(Number(e.target.value))}
              className="np-range"
              aria-label="Tiến trình bài hát"
            />
            <span className="np-time">{formatTime(progress.dur)}</span>
          </div>

          {/* Controls row */}
          <div className="np-controls-row">
            <div className="np-controls-left">
              <motion.button
                type="button"
                className={"icon-btn np-ctrl" + (shuffleEnabled ? " active" : "")}
                onClick={onToggleShuffle}
                whileTap={{ scale: 0.9 }}
                aria-label="Shuffle"
              >
                <Shuffle size={18} />
              </motion.button>
              <motion.button type="button" className="icon-btn np-ctrl" onClick={onPrev} whileTap={{ scale: 0.9 }} aria-label="Bài trước">
                <SkipBack size={20} />
              </motion.button>
              {isBuffering && !isPlaying ? (
                <div className="np-play-btn" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div className="mini-spinner" style={{ width: 28, height: 28 }} />
                </div>
              ) : (
              <motion.button type="button" className="np-play-btn" onClick={onToggle} whileTap={{ scale: 0.92 }} aria-label={isPlaying ? "Tạm dừng" : "Phát"}>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={isPlaying ? "pause" : "play"}
                    initial={{ opacity: 0, scale: 0.5, rotate: -10 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    exit={{ opacity: 0, scale: 0.5, rotate: 10 }}
                    transition={{ duration: 0.18 }}
                    style={{ display: "flex" }}
                  >
                    {isPlaying ? <Pause size={24} /> : <Play size={24} style={{ marginLeft: 2 }} />}
                  </motion.span>
                </AnimatePresence>
              </motion.button>
              )}
              <motion.button type="button" className="icon-btn np-ctrl" onClick={onNext} whileTap={{ scale: 0.9 }} aria-label="Bài tiếp">
                <SkipForward size={20} />
              </motion.button>
              <motion.button
                type="button"
                className={"icon-btn np-ctrl" + (repeatMode !== "off" ? " active" : "")}
                onClick={onToggleRepeat}
                whileTap={{ scale: 0.9 }}
                aria-label={repeatMode === "one" ? "Repeat One" : repeatMode === "all" ? "Repeat All" : "Repeat Off"}
                style={{ position: "relative" }}
              >
                <Repeat size={18} />
                {repeatMode === "one" && <span className="np-repeat-badge">1</span>}
              </motion.button>
            </div>

            <div className="np-controls-right">
              <div className="np-volume-wrap">
                <Volume2 size={16} />
                <input type="range" min="0" max="100" value={volume} onChange={(e) => onVolume(Number(e.target.value))} className="np-range-sm" aria-label="Âm lượng" />
              </div>

              <motion.button type="button" className="np-secondary-btn" onClick={onOpenQueue} whileTap={{ scale: 0.95 }} aria-label="Xem hàng chờ">
                <ListMusic size={16} />
                <span>Hàng chờ</span>
              </motion.button>

              {onStartSleepTimer && (
                <div className="np-sleep-wrap">
                  <motion.button
                    type="button"
                    className={"np-secondary-btn" + (sleepTimer ? " active" : "")}
                    onClick={() => {
                      if (sleepTimer) { onClearSleepTimer(); return; }
                      const menu = document.getElementById("np-sleep-menu");
                      if (menu) menu.style.display = menu.style.display === "block" ? "none" : "block";
                    }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Timer size={14} />
                    <span>{sleepTimer ? Math.ceil(sleepTimerRemaining / 60) + "m" : "Sleep"}</span>
                  </motion.button>
                  <div id="np-sleep-menu" className="np-sleep-menu">
                    {[5, 10, 15, 30, 45, 60].map((m) => (
                      <button key={m} type="button" className="np-sleep-option" onClick={() => { onStartSleepTimer(m); document.getElementById("np-sleep-menu").style.display = "none"; }}>
                        {m} phút
                      </button>
                    ))}
                    <button type="button" className="np-sleep-option" onClick={() => { onStartSleepTimer(999); document.getElementById("np-sleep-menu").style.display = "none"; }}>
                      Hết bài
                    </button>
                    <button type="button" className="np-sleep-option" onClick={() => { onClearSleepTimer(); document.getElementById("np-sleep-menu").style.display = "none"; }}>
                      Tắt
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── EXTRA: Credits, Related (scrollable below controls) ── */}
        {isLocal && currentTrack && (
          <div className="np-extras">
            {currentTrack.credits && currentTrack.credits.length > 0 && (
              <section className="np-extra-section">
                <p className="section-label">Thông tin</p>
                <ul className="np-credits">
                  {currentTrack.credits.map((c, i) => (
                    <li key={i}>
                      <span>{creditRoleLabel(c.role)}</span>
                      <span>
                        {c.artistUsername ? (
                          <span className="artist-link" onClick={() => onOpenArtist(c.artistUsername)}>{c.artistName}</span>
                        ) : (c.artistName || c.externalName)}
                        {c.badge && <ArtistBadge badge={c.badge} size={13} />}
                      </span>
                    </li>
                  ))}
                  <li>
                    <span>Đăng bởi</span>
                    <span className="np-credit-uploader">
                      {currentTrack.uploaderBadge ? (
                        <span className="artist-link" onClick={() => onOpenArtist(currentTrack.uploaderUsername)}>
                          {currentTrack.uploaderDisplayName}
                        </span>
                      ) : currentTrack.uploaderDisplayName}
                      <ArtistBadge badge={currentTrack.uploaderBadge} size={13} />
                    </span>
                  </li>
                  {currentTrack.releaseDate && (
                    <li><span>Phát hành</span><span>{formatDate(currentTrack.releaseDate)}</span></li>
                  )}
                </ul>
                {currentTrack.genres && currentTrack.genres.length > 0 && (
                  <div className="genre-chip-row" style={{ marginTop: "var(--sp-3)" }}>
                    {currentTrack.genres.map((g) => <span key={g} className="genre-chip">{g}</span>)}
                  </div>
                )}
              </section>
            )}

            {related.length > 0 && (
              <section className="np-extra-section">
                <TrackRail
                  title="Nghe tiếp"
                  tracks={related}
                  session={session} current={current} isPlaying={isPlaying} progress={progress}
                  onPlay={onPlay} onLike={onLike} onSave={onSave} onShare={onShare} onComment={onComment} onLyrics={onLyrics}
                  onAddToPlaylist={onAddToPlaylist}
                />
              </section>
            )}
          </div>
        )}
      </motion.div>
    </motion.div>

    {/* ── FULLSCREEN LYRICS OVERLAY ── */}
    <AnimatePresence>
      {lyricsFullscreen && isLocal && currentTrack && (
        <motion.div
          className="lyrics-fullscreen-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
        >
          {/* Ambient artwork background */}
          <div
            className="lyrics-fullscreen-bg"
            style={currentTrack.coverUrl ? { backgroundImage: `url('${currentTrack.coverUrl}')` } : {}}
          />
          <div className="lyrics-fullscreen-content">
            <div className="lyrics-fullscreen-header">
              <button type="button" className="lyrics-fullscreen-close" onClick={toggleLyricsFullscreen} aria-label="Đóng">
                <Minimize2 size={20} />
              </button>
              <div className="lyrics-fullscreen-song-info">
                <span className="lyrics-fullscreen-title">{current.title}</span>
                <span className="lyrics-fullscreen-artist">{currentTrack.primaryArtistName || currentTrack.uploaderDisplayName}</span>
              </div>
            </div>
            <TimedLyrics
              timedLyrics={currentTrack.timedLyrics || null}
              plainLyrics={currentTrack.lyrics || null}
              currentTime={progress.cur}
              duration={progress.dur}
              title={current.title}
              coverUrl={currentTrack.coverUrl}
              artistName={currentTrack.primaryArtistName || currentTrack.uploaderDisplayName}
              onSeek={(time) => {
                if (onSeek) onSeek(Math.round((time / Math.max(progress.dur, 1)) * 1000));
              }}
              isPlaying={isPlaying}
              onToggleFullscreen={toggleLyricsFullscreen}
              isFullscreen={true}
            />
            {/* Bottom controls */}
            <div className="lyrics-fullscreen-controls">
              <span className="lyrics-fullscreen-time">{formatTime(progress.cur)}</span>
              <div className="lyrics-fullscreen-progress">
                <div className="lyrics-fullscreen-progress-fill" style={{ width: pct / 10 + "%" }} />
              </div>
              <span className="lyrics-fullscreen-time">{formatTime(progress.dur)}</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
}
