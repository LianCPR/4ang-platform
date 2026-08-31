import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { gradientFor } from "../lib/format";

const TARGET_DEG_PER_SEC = 70;
const EASE = 2.4;

export default function VinylRecord({ artUrl, artHue, isPlaying, size = 220, className = "" }) {
  const discRef = useRef(null);
  const angleRef = useRef(0);
  const velocityRef = useRef(0);
  const rafRef = useRef(null);
  const lastTsRef = useRef(null);

  useEffect(() => {
    const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      if (discRef.current) discRef.current.style.transform = "rotate(0deg)";
      return;
    }
    function tick(ts) {
      if (lastTsRef.current == null) lastTsRef.current = ts;
      const dt = Math.min((ts - lastTsRef.current) / 1000, 0.05);
      lastTsRef.current = ts;
      const target = isPlaying ? TARGET_DEG_PER_SEC : 0;
      velocityRef.current += (target - velocityRef.current) * Math.min(dt * EASE, 1);
      angleRef.current = (angleRef.current + velocityRef.current * dt) % 360;
      if (discRef.current) discRef.current.style.transform = "rotate(" + angleRef.current + "deg)";
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastTsRef.current = null;
    };
  }, [isPlaying]);

  return (
    <div className={"vinyl-container " + className} style={{ width: size + 40, height: size + 20 }}>
      {/* Tonearm */}
      <div className={"vinyl-tonearm " + (isPlaying ? "playing" : "")}>
        <svg width="60" height="80" viewBox="0 0 60 80" fill="none">
          {/* Arm pivot */}
          <circle cx="50" cy="10" r="6" fill="#8B7355" opacity="0.6" />
          <circle cx="50" cy="10" r="3" fill="#715A45" opacity="0.8" />
          {/* Arm body */}
          <line x1="50" y1="10" x2="18" y2="55" stroke="#715A45" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
          {/* Headshell */}
          <rect x="12" y="52" width="12" height="6" rx="2" fill="#715A45" opacity="0.6" />
          {/* Stylus */}
          <line x1="14" y1="58" x2="13" y2="63" stroke="#715A45" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
          {/* Counter weight */}
          <circle cx="52" cy="8" r="4" fill="#A09888" opacity="0.4" />
        </svg>
      </div>

      {/* Vinyl disc */}
      <div className="vinyl" style={{ width: size, height: size }}>
        <div className="vinyl-disc" ref={discRef}>
          {/* Outer rim */}
          <div className="vinyl-rim" />
          {/* Grooves */}
          <div className="vinyl-grooves" />
          <div className="vinyl-grooves-inner" />
          {/* Label area */}
          <div className="vinyl-label-ring" />
          {/* Artwork center */}
          <div className="vinyl-art-wrap">
            <AnimatePresence mode="wait">
              <motion.div
                key={artUrl || artHue}
                className="vinyl-art"
                style={artUrl ? { backgroundImage: "url('" + artUrl + "')" } : { background: gradientFor(artHue) }}
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              />
            </AnimatePresence>
          </div>
          {/* Center hole */}
          <div className="vinyl-hole" />
        </div>
        {/* Light reflection */}
        <div className="vinyl-reflection" />
        {/* Shadow */}
        <div className="vinyl-shadow" />
      </div>
    </div>
  );
}
