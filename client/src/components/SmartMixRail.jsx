import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Sparkles, Play, Pause, Moon, Zap, Heart, Music, Radio } from "lucide-react";
import { api } from "../api";
import { gradientFor, hashHue, formatTime } from "../lib/format";

/* ─── Mix Type Definitions ──────────────────────────────── */
const MIX_TYPES = [
  { id: "my-mix", label: "My Mix", sublabel: "Dành riêng cho bạn", icon: Sparkles, gradient: "linear-gradient(135deg, #6F8066 0%, #9AA68A 100%)" },
  { id: "chill", label: "Chill Mix", sublabel: "Dịu dàng, thư giãn", icon: Heart, gradient: "linear-gradient(135deg, #B8858A 0%, #D9A3A0 100%)" },
  { id: "energy", label: "Energy Mix", sublabel: "Năng lượng, sôi động", icon: Zap, gradient: "linear-gradient(135deg, #C9A76B 0%, #D8B46A 100%)" },
  { id: "late-night", label: "Late Night", sublabel: "Đêm muộn tĩnh lặng", icon: Moon, gradient: "linear-gradient(135deg, #5A4535 0%, #715A45 100%)" },
  { id: "artist", label: "Artist Mix", sublabel: "Nghệ sĩ bạn theo dõi", icon: Radio, gradient: "linear-gradient(135deg, #8B7355 0%, #B8A088 100%)" },
  { id: "genre", label: "Genre Mix", sublabel: "Thể loại yêu thích", icon: Music, gradient: "linear-gradient(135deg, #D5AE90 0%, #EBC6A8 100%)" },
];

/* ─── Single Mix Card ────────────────────────────────────── */
function MixCard({ track, index, isCurrent, isPlaying, onPlay }) {
  const artist = track.primaryArtistName || track.credits?.[0]?.artistName || track.composer || track.uploaderDisplayName;
  return (
    <motion.button
      type="button"
      className="smart-mix-card"
      onClick={() => onPlay(index)}
      whileHover={{ y: -3, scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.2 }}
    >
      <div className="smart-mix-art-wrap">
        <div
          className="smart-mix-art"
          style={track.coverUrl
            ? { backgroundImage: `url('${track.coverUrl}')` }
            : { background: gradientFor(hashHue(track.title)) }
          }
        />
        <div className={`smart-mix-play-overlay ${isCurrent && isPlaying ? "visible" : ""}`}>
          {isCurrent && isPlaying ? <Pause size={18} /> : <Play size={18} />}
        </div>
      </div>
      <div className="smart-mix-title">{track.title}</div>
      <div className="smart-mix-artist">{artist}</div>
    </motion.button>
  );
}

/* ══════════════════════════════════════════════════════════ */
export default function SmartMixRail({ type = "my-mix", title, subtitle, current, isPlaying, onPlay, onLike }) {
  const [activeType, setActiveType] = useState(type);
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hoveredType, setHoveredType] = useState(null);

  const fetchMix = useCallback((mixType) => {
    setLoading(true);
    setTracks([]);
    api.smartMix(mixType, 10).then((data) => {
      setTracks(data.tracks || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => { fetchMix(activeType); }, [activeType, fetchMix]);

  const activeDef = MIX_TYPES.find((m) => m.id === activeType) || MIX_TYPES[0];
  const Icon = activeDef.icon;

  return (
    <div className="home-section smart-mix-section">
      <div className="smart-mix-header">
        <div className="smart-mix-header-left">
          <div className="smart-mix-icon-wrap" style={{ background: activeDef.gradient }}>
            <Icon size={18} color="white" />
          </div>
          <div>
            <h2 className="smart-mix-title-text">{title || activeDef.label}</h2>
            <span className="smart-mix-subtitle">{activeDef.sublabel}</span>
          </div>
        </div>
      </div>

      {/* ── Mix Type Selector ── */}
      <div className="smart-mix-types">
        {MIX_TYPES.map((m) => {
          const TypeIcon = m.icon;
          const isActive = m.id === activeType;
          const isHovered = m.id === hoveredType;
          return (
            <button
              key={m.id}
              type="button"
              className={"smart-mix-type-btn" + (isActive ? " active" : "")}
              onClick={() => setActiveType(m.id)}
              onMouseEnter={() => setHoveredType(m.id)}
              onMouseLeave={() => setHoveredType(null)}
              style={isActive ? { background: m.gradient, color: "white", borderColor: "transparent" } : {}}
            >
              <TypeIcon size={14} />
              <span>{m.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Track Rail ── */}
      {loading ? (
        <div className="smart-mix-rail">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="smart-mix-card skeleton">
              <div className="smart-mix-art skeleton-pulse" />
              <div className="smart-mix-title skeleton-line" />
              <div className="smart-mix-artist skeleton-line short" />
            </div>
          ))}
        </div>
      ) : tracks.length === 0 ? (
        <div className="smart-mix-empty">
          <Sparkles size={24} style={{ color: "var(--c-sage)", opacity: 0.3 }} />
          <p>Chưa đủ dữ liệu cho mix này.</p>
          <p className="smart-mix-empty-sub">Nghe nhạc và thích bài để 4ANG hiểu gu của bạn hơn.</p>
        </div>
      ) : (
        <div className="smart-mix-rail">
          {tracks.map((t, i) => (
            <MixCard
              key={t.id}
              track={t}
              index={i}
              isCurrent={current && current.trackId === t.id}
              isPlaying={isPlaying}
              onPlay={(idx) => onPlay(tracks, idx)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
