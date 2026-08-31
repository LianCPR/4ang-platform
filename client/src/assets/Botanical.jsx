/* ═══════════════════════════════════════════════════════════
   BOTANICAL — Original SVG decorative motifs
   Floral, vine, butterfly, bird line art for the 4ANG garden theme
   All pure stroke/fill paths — no borrowed artwork.
   ═══════════════════════════════════════════════════════════ */

/* A small sprig with leaves — the legacy 4ANG motif, now in sage green */
export function Sprig({ size = 40, className = "", flip = false }) {
  return (
    <svg
      className={className}
      width={size}
      height={size * 1.1}
      viewBox="0 0 40 44"
      fill="none"
      style={flip ? { transform: "scaleX(-1)" } : undefined}
      aria-hidden="true"
    >
      <path d="M20 42 C19 30 19.5 18 20.5 3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      <path d="M20 34 C15 32 11 28 9.5 22" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" />
      <ellipse cx="8" cy="20.5" rx="4.2" ry="2" transform="rotate(-32 8 20.5)" fill="currentColor" opacity="0.7" />
      <path d="M20.5 26 C24.5 24 27.5 20.5 28.5 15.5" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" />
      <ellipse cx="29.5" cy="14" rx="4.2" ry="2" transform="rotate(30 29.5 14)" fill="currentColor" opacity="0.7" />
      <path d="M20 18 C16.5 16 13.8 13 12.6 8.6" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" />
      <ellipse cx="11.6" cy="7.4" rx="3.6" ry="1.7" transform="rotate(-28 11.6 7.4)" fill="currentColor" opacity="0.65" />
      <path d="M20.8 10 C23.6 8.4 25.7 6 26.6 2.6" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" />
      <ellipse cx="27.4" cy="1.6" rx="3.4" ry="1.6" transform="rotate(30 27.4 1.6)" fill="currentColor" opacity="0.65" />
    </svg>
  );
}

/* A small flower with petals — used in empty states, loading, auth */
export function Flower({ size = 32, className = "", color = "currentColor" }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      {/* Petals */}
      <ellipse cx="16" cy="8" rx="3.5" ry="6" fill={color} opacity="0.35" />
      <ellipse cx="16" cy="8" rx="3.5" ry="6" fill={color} opacity="0.35" transform="rotate(60 16 16)" />
      <ellipse cx="16" cy="8" rx="3.5" ry="6" fill={color} opacity="0.35" transform="rotate(120 16 16)" />
      <ellipse cx="16" cy="8" rx="3.5" ry="6" fill={color} opacity="0.35" transform="rotate(180 16 16)" />
      <ellipse cx="16" cy="8" rx="3.5" ry="6" fill={color} opacity="0.35" transform="rotate(240 16 16)" />
      <ellipse cx="16" cy="8" rx="3.5" ry="6" fill={color} opacity="0.35" transform="rotate(300 16 16)" />
      {/* Center */}
      <circle cx="16" cy="16" r="3" fill={color} opacity="0.5" />
      <circle cx="16" cy="16" r="1.5" fill={color} opacity="0.7" />
    </svg>
  );
}

/* A small butterfly — atmospheric, used sparingly */
export function Butterfly({ size = 24, className = "" }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      {/* Left wing */}
      <path d="M12 12 C10 8 4 4 3 7 C2 10 6 13 12 12" fill="currentColor" opacity="0.25" stroke="currentColor" strokeWidth="0.6" />
      {/* Right wing */}
      <path d="M12 12 C14 8 20 4 21 7 C22 10 18 13 12 12" fill="currentColor" opacity="0.25" stroke="currentColor" strokeWidth="0.6" />
      {/* Lower wings */}
      <path d="M12 12 C10 16 6 20 7 19 C8 18 11 14 12 12" fill="currentColor" opacity="0.2" stroke="currentColor" strokeWidth="0.5" />
      <path d="M12 12 C14 16 18 20 17 19 C16 18 13 14 12 12" fill="currentColor" opacity="0.2" stroke="currentColor" strokeWidth="0.5" />
      {/* Body */}
      <line x1="12" y1="8" x2="12" y2="18" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" />
      {/* Antennae */}
      <path d="M12 8 C11 6 9 5 8 5" stroke="currentColor" strokeWidth="0.5" strokeLinecap="round" />
      <path d="M12 8 C13 6 15 5 16 5" stroke="currentColor" strokeWidth="0.5" strokeLinecap="round" />
    </svg>
  );
}

/* A small bird — resting on a branch, atmospheric */
export function Bird({ size = 20, className = "", flip = false }) {
  return (
    <svg
      className={className}
      width={size}
      height={size * 0.9}
      viewBox="0 0 20 18"
      fill="none"
      style={flip ? { transform: "scaleX(-1)" } : undefined}
      aria-hidden="true"
    >
      {/* Body */}
      <ellipse cx="10" cy="10" rx="5" ry="3.5" fill="currentColor" opacity="0.2" stroke="currentColor" strokeWidth="0.6" />
      {/* Head */}
      <circle cx="15" cy="8" r="2.2" fill="currentColor" opacity="0.2" stroke="currentColor" strokeWidth="0.6" />
      {/* Eye */}
      <circle cx="15.8" cy="7.6" r="0.6" fill="currentColor" opacity="0.5" />
      {/* Beak */}
      <path d="M17 8 L19 7.5 L17.2 8.5" fill="currentColor" opacity="0.4" stroke="currentColor" strokeWidth="0.4" />
      {/* Wing */}
      <path d="M8 9 C6 7 5 5 7 6 C9 7 10 9 8 9" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="0.5" />
      {/* Tail */}
      <path d="M5 10 C3 9 2 11 4 10.5" stroke="currentColor" strokeWidth="0.5" strokeLinecap="round" />
      {/* Legs */}
      <path d="M10 13 L9 16" stroke="currentColor" strokeWidth="0.4" strokeLinecap="round" />
      <path d="M12 13 L13 16" stroke="currentColor" strokeWidth="0.4" strokeLinecap="round" />
    </svg>
  );
}

/* A vine with leaves — decorative border element */
export function Vine({ size = 60, className = "", direction = "right" }) {
  const flip = direction === "left";
  return (
    <svg
      className={className}
      width={size}
      height={size * 0.4}
      viewBox="0 0 60 24"
      fill="none"
      style={flip ? { transform: "scaleX(-1)" } : undefined}
      aria-hidden="true"
    >
      {/* Main vine */}
      <path d="M2 20 C10 18 20 10 30 12 C40 14 50 6 58 4" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" opacity="0.4" />
      {/* Leaves along the vine */}
      <ellipse cx="15" cy="15" rx="3" ry="1.5" transform="rotate(-20 15 15)" fill="currentColor" opacity="0.2" />
      <ellipse cx="25" cy="11" rx="2.5" ry="1.3" transform="rotate(15 25 11)" fill="currentColor" opacity="0.2" />
      <ellipse cx="38" cy="10" rx="3" ry="1.5" transform="rotate(-25 38 10)" fill="currentColor" opacity="0.18" />
      <ellipse cx="50" cy="5" rx="2.5" ry="1.2" transform="rotate(10 50 5)" fill="currentColor" opacity="0.18" />
      {/* Small flower bud */}
      <circle cx="32" cy="11" r="1.5" fill="currentColor" opacity="0.25" />
      <circle cx="32" cy="11" r="0.7" fill="currentColor" opacity="0.4" />
    </svg>
  );
}

/* A small rose/flower cluster — for headers */
export function RoseCluster({ size = 40, className = "" }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
    >
      {/* Main rose */}
      <circle cx="20" cy="16" r="6" fill="currentColor" opacity="0.15" />
      <path d="M20 10 C22 12 24 14 22 16 C20 18 18 16 20 14 C22 12 20 10 20 10" fill="currentColor" opacity="0.2" />
      {/* Small buds */}
      <circle cx="14" cy="22" r="3" fill="currentColor" opacity="0.12" />
      <circle cx="28" cy="20" r="3.5" fill="currentColor" opacity="0.12" />
      {/* Stems */}
      <path d="M20 22 C18 28 16 34 15 38" stroke="currentColor" strokeWidth="0.7" strokeLinecap="round" opacity="0.3" />
      <path d="M14 25 C12 30 11 34 10 38" stroke="currentColor" strokeWidth="0.5" strokeLinecap="round" opacity="0.25" />
      {/* Leaves */}
      <ellipse cx="16" cy="30" rx="3" ry="1.5" transform="rotate(-30 16 30)" fill="currentColor" opacity="0.15" />
      <ellipse cx="12" cy="34" rx="2.5" ry="1.2" transform="rotate(20 12 34)" fill="currentColor" opacity="0.12" />
    </svg>
  );
}

export function DividerFlourish({ className = "" }) {
  return (
    <div className={"divider-flourish " + className} aria-hidden="true">
      <span className="divider-line" />
      <Flower size={16} />
      <span className="divider-line" />
    </div>
  );
}

export function CornerOrnament({ size = 26, className = "" }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 26 26"
      fill="none"
      aria-hidden="true"
    >
      <path d="M2 24 C2 12 8 3 22 2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
      <ellipse cx="4.4" cy="18.2" rx="2.6" ry="1.2" transform="rotate(-52 4.4 18.2)" fill="currentColor" opacity="0.4" />
      <ellipse cx="12.6" cy="4.4" rx="2.6" ry="1.2" transform="rotate(15 12.6 4.4)" fill="currentColor" opacity="0.35" />
      <circle cx="3" cy="20" r="1" fill="currentColor" opacity="0.3" />
    </svg>
  );
}

/* Leaf petal — for scattered decorative use */
export function Petal({ size = 12, className = "", rotation = 0 }) {
  return (
    <svg
      className={className}
      width={size}
      height={size * 1.4}
      viewBox="0 0 10 14"
      fill="none"
      style={{ transform: "rotate(" + rotation + "deg)" }}
      aria-hidden="true"
    >
      <path
        d="M5 0 C8 3 9 8 5 14 C1 8 2 3 5 0"
        fill="currentColor"
        opacity="0.15"
      />
      <path
        d="M5 2 L5 12"
        stroke="currentColor"
        strokeWidth="0.4"
        opacity="0.2"
      />
    </svg>
  );
}
