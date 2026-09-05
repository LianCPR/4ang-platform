import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, SkipBack, SkipForward, Heart, Shuffle, Repeat, ListMusic, AlignLeft } from "lucide-react";
import { gradientFor, hashHue, formatTime } from "../lib/format";

export default function MiniPlayer({ current, isPlaying, progress, session, currentTrack, onOpen, onPrev, onToggle, onNext, onLike, onLyrics, onSeek, shuffleEnabled, repeatMode, onToggleShuffle, onToggleRepeat, audioState, audioError, onRetry }) {
  const pct = progress.dur > 0 ? (progress.cur / progress.dur) * 100 : 0;
  const liked = currentTrack ? currentTrack.likedBy.includes(session.username) : false;
  const isBuffering = audioState === "buffering" || audioState === "loading";
  const isError = audioState === "error";

  function handleSeek(e) {
    e.stopPropagation();
    const val = Number(e.target.value);
    if (onSeek) onSeek(val);
  }

  return (
    <motion.div
      className="mini-player"
      initial={{ y: 90, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 90, opacity: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 30 }}
    >
      {/* Progress bar on top edge */}
      <div className="mini-progress">
        <div className="mini-progress-fill" style={{ width: pct + "%" }} />
      </div>

      <div className="mini-player-inner">
        {/* Left: artwork + info — clickable to open full player */}
        <div className="mini-left" onClick={onOpen}>
          <motion.div
            className="mini-art"
            layoutId={current.trackId ? "mini-art-" + current.trackId : undefined}
            style={current.thumb ? { backgroundImage: `url('${current.thumb}')` } : { background: gradientFor(current.hue) }}
            whileHover={{ scale: 1.05 }}
            transition={{ duration: 0.2 }}
          />
          <div className="mini-info">
            <div className="mini-title">{current.title}</div>
            <div className="mini-artist">{current.artist}</div>
          </div>
          {currentTrack && (
            <motion.button
              type="button"
              className={"icon-btn mini-like" + (liked ? " active active-wine" : "")}
              onClick={(e) => { e.stopPropagation(); onLike(); }}
              whileTap={{ scale: 0.85 }}
              aria-label="Thả tym"
            >
              <Heart size={15} fill={liked ? "currentColor" : "none"} />
            </motion.button>
          )}
        </div>

        {/* Center: controls */}
        <div className="mini-center" onClick={(e) => e.stopPropagation()}>
          <motion.button type="button" className={"icon-btn mini-shuffle" + (shuffleEnabled ? " active" : "")} onClick={onToggleShuffle} whileTap={{ scale: 0.9 }} aria-label="Shuffle" style={{ opacity: shuffleEnabled ? 1 : 0.5 }}>
            <Shuffle size={14} />
          </motion.button>
          <motion.button type="button" className="icon-btn" onClick={onPrev} whileTap={{ scale: 0.9 }} aria-label="Bài trước">
            <SkipBack size={16} />
          </motion.button>
          {isBuffering && !isPlaying ? (
            <div className="mini-spinner" />
          ) : (
            <motion.button type="button" className="mini-play-btn" onClick={isError ? onRetry : onToggle} whileTap={{ scale: 0.92 }} aria-label={isError ? "Thử lại" : isPlaying ? "Tạm dừng" : "Phát"}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={isPlaying ? "pause" : "play"}
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  transition={{ duration: 0.15 }}
                  style={{ display: "flex" }}
                >
                  {isPlaying ? <Pause size={18} /> : <Play size={18} style={{ marginLeft: 2 }} />}
                </motion.span>
              </AnimatePresence>
            </motion.button>
          )}
          <motion.button type="button" className="icon-btn" onClick={onNext} whileTap={{ scale: 0.9 }} aria-label="Bài tiếp">
            <SkipForward size={16} />
          </motion.button>
          <motion.button type="button" className={"icon-btn mini-repeat" + (repeatMode !== "off" ? " active" : "")} onClick={onToggleRepeat} whileTap={{ scale: 0.9 }} aria-label={repeatMode === "one" ? "Repeat One" : repeatMode === "all" ? "Repeat All" : "Repeat Off"} style={{ position: "relative", opacity: repeatMode !== "off" ? 1 : 0.5 }}>
            <Repeat size={14} />
            {repeatMode === "one" && <span className="mini-repeat-badge">1</span>}
          </motion.button>
        </div>

        {/* Right: seek bar + time */}
        <div className="mini-right" onClick={(e) => e.stopPropagation()}>
          <span className="mini-time">{formatTime(progress.cur)}</span>
          <input
            type="range" min="0" max="1000" value={Math.round(pct * 10)}
            onChange={handleSeek}
            className="mini-range"
            aria-label="Tiến trình"
          />
          <span className="mini-time">{formatTime(progress.dur)}</span>
        </div>

        {/* Lyrics button */}
        {currentTrack && (
          <motion.button
            type="button"
            className="icon-btn mini-lyrics-btn"
            onClick={(e) => { e.stopPropagation(); onLyrics && onLyrics(); }}
            whileTap={{ scale: 0.9 }}
            aria-label="Lời bài hát"
            title="Lời bài hát"
          >
            <AlignLeft size={15} />
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}
