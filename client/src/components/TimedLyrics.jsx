import { useRef, useEffect, useMemo, useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flower, Maximize2, Minimize2 } from "lucide-react";

/**
 * TimedLyrics — syncs lyrics with audio currentTime.
 * 
 * timedLyrics format: [{ startTime: number, endTime: number, text: string }]
 * Falls back to plain lyrics if timedLyrics is null/empty.
 * 
 * Props:
 * - timedLyrics: array of { startTime, endTime, text } or null
 * - plainLyrics: string (fallback)
 * - currentTime: number (seconds)
 * - duration: number (seconds)
 * - title: string
 * - onSeek: (time: number) => void (click to seek)
 * - isPlaying: boolean
 */
export default function TimedLyrics({ timedLyrics, plainLyrics, currentTime, duration, title, onSeek, isPlaying, coverUrl, artistName, onToggleFullscreen, isFullscreen }) {
  const containerRef = useRef(null);
  const activeLineRef = useRef(null);
  const hasTimed = Array.isArray(timedLyrics) && timedLyrics.length > 0;
  const [seekFlash, setSeekFlash] = useState(null);

  // Find the current line index
  const currentLineIndex = useMemo(() => {
    if (!hasTimed) return -1;
    for (let i = timedLyrics.length - 1; i >= 0; i--) {
      if (currentTime >= timedLyrics[i].startTime) return i;
    }
    return 0;
  }, [hasTimed, timedLyrics, currentTime]);

  // Auto-scroll to keep current line centered
  useEffect(() => {
    if (!hasTimed || !activeLineRef.current || !containerRef.current) return;
    const container = containerRef.current;
    const active = activeLineRef.current;
    const containerHeight = container.clientHeight;
    const lineHeight = active.offsetTop;
    const scrollTo = lineHeight - containerHeight / 2 + active.clientHeight / 2;
    container.scrollTo({ top: scrollTo, behavior: "smooth" });
  }, [currentLineIndex, hasTimed]);

  const handleLineClick = useCallback((time, index) => {
    if (onSeek) onSeek(time);
    setSeekFlash(index);
    setTimeout(() => setSeekFlash(null), 400);
  }, [onSeek]);

  // Plain lyrics fallback
  const cls = isFullscreen ? "timed-lyrics-editorial timed-lyrics-fullscreen" : "timed-lyrics-editorial";

  if (!hasTimed) {
    if (!plainLyrics) {
      return (
        <div className={cls}>
          <div className="lyrics-editorial-header">
            <span className="lyrics-editorial-label">Lời bài hát</span>
            <span className="lyrics-editorial-song">{title}</span>
            {onToggleFullscreen && (
              <button type="button" className="lyrics-fullscreen-btn" onClick={onToggleFullscreen} aria-label={isFullscreen ? "Thu nhỏ" : "Toàn màn hình"}>
                {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
            )}
          </div>
          <div className="timed-lyrics-empty">
            <Flower size={24} />
            <p>Bài này chưa có lời.</p>
            <p className="timed-lyrics-empty-sub">
              Có lẽ điều tuyệt vời nhất<br />vẫn đang chờ được viết ra.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className={cls}>
        <div className="lyrics-editorial-header">
          <span className="lyrics-editorial-label">Lời bài hát</span>
          <span className="lyrics-editorial-song">{title}</span>
          {onToggleFullscreen && (
            <button type="button" className="lyrics-fullscreen-btn" onClick={onToggleFullscreen} aria-label={isFullscreen ? "Thu nhỏ" : "Toàn màn hình"}>
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          )}
        </div>
        <div className="timed-lyrics-plain">
          <div className="lyrics-editorial-ornament-top">
            <Flower size={14} />
          </div>
          <div className="lyrics-editorial-content">
            {plainLyrics.split('\n').map((line, i) => (
              <p key={i} className="lyrics-line">
                {line === '' ? '\u00A0' : line}
              </p>
            ))}
          </div>
          <div className="lyrics-editorial-ornament-bottom">
            <Flower size={14} />
          </div>
        </div>
        <p className="timed-lyrics-hint">Lyrics chưa có bản đồng bộ theo thời gian.</p>
      </div>
    );
  }

  return (
    <div className={cls}>
      <div className="lyrics-editorial-header">
        <span className="lyrics-editorial-label">Lời bài hát</span>
        <span className="lyrics-editorial-song">{title}</span>
        {onToggleFullscreen && (
          <button type="button" className="lyrics-fullscreen-btn" onClick={onToggleFullscreen} aria-label={isFullscreen ? "Thu nhỏ" : "Toàn màn hình"}>
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        )}
      </div>
      <div className="timed-lyrics-scroll" ref={containerRef}>
        <div className="timed-lyrics-ornament-top">
          <Flower size={12} />
        </div>
        <div className="timed-lyrics-lines">
          {timedLyrics.map((line, i) => {
            const isActive = i === currentLineIndex;
            const isPast = i < currentLineIndex;
            const isFlash = i === seekFlash;
            const distance = isActive ? 0 : Math.abs(i - currentLineIndex);
            const cls = [
              "timed-lyric-line",
              isActive && "active",
              isPast && "past",
              isFlash && "flash",
            ].filter(Boolean).join(" ");
            return (
              <motion.p
                key={i}
                ref={isActive ? activeLineRef : null}
                className={cls}
                onClick={() => handleLineClick(line.startTime, i)}
                animate={{
                  opacity: isActive ? 1 : isPast ? 0.35 : Math.max(0.5, 1 - distance * 0.12),
                  scale: isActive ? 1.05 : isFlash ? 1.02 : 1,
                  y: isActive ? -2 : 0,
                }}
                transition={{ duration: 0.35, ease: "easeOut" }}
              >
                {line.text || '\u00A0'}
                {isActive && isPlaying && <span className="karaoke-glow" />}
              </motion.p>
            );
          })}
        </div>
        <div className="timed-lyrics-ornament-bottom">
          <Flower size={12} />
        </div>
      </div>
    </div>
  );
}
