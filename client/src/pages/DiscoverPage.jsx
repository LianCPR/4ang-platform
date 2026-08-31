import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Music, Users, Play, Clock, TrendingUp, Sparkles, Headphones, ChevronRight, ChevronLeft, Pause } from "lucide-react";
import { api } from "../api";
import { Butterfly, Flower, Vine, RoseCluster, Petal } from "../assets/Botanical";
import { gradientFor, hashHue, formatTime } from "../lib/format";

/* ─── Fade-in section ─────────────────────────── */
function Section({ children, delay = 0, className = "" }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {children}
    </motion.div>
  );
}

/* ─── Horizontal scroll arrows ────────────────── */
function ScrollArrows({ containerRef }) {
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(true);
  const check = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, [containerRef]);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    check();
    el.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => { el.removeEventListener("scroll", check); window.removeEventListener("resize", check); };
  }, [check, containerRef]);
  const scroll = (dir) => {
    const el = containerRef.current;
    if (el) el.scrollBy({ left: dir * 300, behavior: "smooth" });
  };
  return (
    <>
      {canLeft && (
        <button className="disc-scroll-arrow disc-scroll-left" onClick={() => scroll(-1)} aria-label="Scroll left">
          <ChevronLeft size={18} />
        </button>
      )}
      {canRight && (
        <button className="disc-scroll-arrow disc-scroll-right" onClick={() => scroll(1)} aria-label="Scroll right">
          <ChevronRight size={18} />
        </button>
      )}
    </>
  );
}

/* ─── Mood data ──────────────────────────────── */
const MOODS = [
  { id: "morning", emoji: "☀️", title: "Buổi sáng", sub: "dịu dàng", gradient: "linear-gradient(135deg, #f5d79e 0%, #e8b46a 100%)" },
  { id: "sunset", emoji: "🌅", title: "Chill", sub: "hoàng hôn", gradient: "linear-gradient(135deg, #e8a87c 0%, #c0856e 100%)" },
  { id: "rain", emoji: "🌧️", title: "Ngày mưa", sub: "", gradient: "linear-gradient(135deg, #a8c0d6 0%, #7396b2 100%)" },
  { id: "night", emoji: "🌙", title: "Đêm", sub: "muộn", gradient: "linear-gradient(135deg, #4a4563 0%, #2f2b42 100%)" },
  { id: "focus", emoji: "📖", title: "Tập trung", sub: "", gradient: "linear-gradient(135deg, #9aa68a 0%, #6f8066 100%)" },
  { id: "love", emoji: "💕", title: "Lãng mạn", sub: "", gradient: "linear-gradient(135deg, #d4869c 0%, #8e4f68 100%)" },
];

/* ─── Time-based greeting ────────────────────── */
function getGreeting() {
  const h = new Date().getHours();
  if (h < 5) return "Đêm khuya";
  if (h < 12) return "Chào buổi sáng";
  if (h < 17) return "Chào buổi chiều";
  if (h < 21) return "Buổi tối vui vẻ";
  return "Đêm nay nghe gì";
}

/* ─── Skeletons ──────────────────────────────── */
function SkeletonHero() {
  return (
    <div className="disc-skeleton-hero">
      <div className="disc-sk-line" style={{ width: 120, height: 12, borderRadius: 6 }} />
      <div className="disc-sk-line" style={{ width: 300, height: 28, borderRadius: 8, marginTop: 10 }} />
      <div className="disc-sk-line" style={{ width: 200, height: 12, borderRadius: 6, marginTop: 8 }} />
    </div>
  );
}
function SkeletonCards({ count = 5 }) {
  return (
    <div className="disc-sk-cards">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="disc-sk-card">
          <div className="disc-sk-art" />
          <div className="disc-sk-line" style={{ width: "70%", height: 11, borderRadius: 4, marginTop: 8 }} />
          <div className="disc-sk-line" style={{ width: "50%", height: 9, borderRadius: 4, marginTop: 4 }} />
        </div>
      ))}
    </div>
  );
}
function SkeletonList({ count = 5 }) {
  return (
    <div className="disc-sk-list">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="disc-sk-row">
          <div className="disc-sk-rank" />
          <div className="disc-sk-art-sm" />
          <div style={{ flex: 1 }}>
            <div className="disc-sk-line" style={{ width: "60%", height: 11, borderRadius: 4 }} />
            <div className="disc-sk-line" style={{ width: "40%", height: 9, borderRadius: 4, marginTop: 4 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════ */
export default function DiscoverPage({
  session, tracks, current, isPlaying, progress,
  onPlay, onLike, onSave, onShare, onComment, onLyrics, onAddToPlaylist,
  onOpenArtist, onOpenGenre, onOpenPlaylist,
}) {
  const [trending, setTrending] = useState([]);
  const [newReleases, setNewReleases] = useState([]);
  const [risingArtists, setRisingArtists] = useState([]);
  const [genres, setGenres] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [becauseYouListened, setBecauseYouListened] = useState([]);
  const [loading, setLoading] = useState(true);

  const quickPickRef = useRef(null);
  const newReleaseRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [t, nr, ra, g, rec, byl] = await Promise.all([
          api.trending(10).catch(() => ({ tracks: [] })),
          api.newReleases(12).catch(() => ({ tracks: [] })),
          api.risingArtists(10).catch(() => ({ artists: [] })),
          api.discoverGenres().catch(() => ({ genres: [] })),
          api.recommendations(10).catch(() => ({ tracks: [] })),
          api.becauseYouListened(8).catch(() => ({ tracks: [] })),
        ]);
        if (!cancelled) {
          setTrending(t.tracks || []);
          setNewReleases(nr.tracks || []);
          setRisingArtists(ra.artists || []);
          setGenres(g.genres || []);
          setRecommendations(rec.tracks || []);
          setBecauseYouListened(byl.tracks || []);
        }
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  /* ── Fallback computed data ── */
  const displayTrending = useMemo(() =>
    trending.length > 0 ? trending : tracks.slice(0, 8).sort((a, b) => (b.playCount || 0) - (a.playCount || 0)),
    [trending, tracks]
  );
  const displayNew = useMemo(() =>
    newReleases.length > 0 ? newReleases : tracks.slice(0, 8),
    [newReleases, tracks]
  );
  const displayRecs = useMemo(() =>
    recommendations.length > 0 ? recommendations : becauseYouListened.length > 0 ? becauseYouListened : tracks.slice(0, 8),
    [recommendations, becauseYouListened, tracks]
  );
  const allGenres = useMemo(() =>
    genres.length > 0 ? genres :
    [...new Set(tracks.flatMap((t) => t.genres || []))].slice(0, 12).map((g) => ({ name: g })),
    [genres, tracks]
  );

  /* ── Quick picks: mix of recs + recently popular ── */
  const quickPicks = useMemo(() => {
    const pool = displayRecs.length > 0 ? displayRecs : displayTrending;
    return pool.slice(0, 8).filter((t) => t.coverUrl);
  }, [displayRecs, displayTrending]);

  /* ── Helper: get artist name ── */
  function artistName(t) {
    return (t.credits && t.credits[0] && t.credits[0].artistName) || t.composer || t.uploaderDisplayName || "Unknown";
  }

  /* ── Is current song? ── */
  function isCur(t) { return current && current.trackId === t.id; }

  /* ── Play a track from a specific list ── */
  function playFrom(list, i) { onPlay(list.length ? list : tracks, i); }

  const greeting = getGreeting();
  const firstName = session ? (session.displayName || "").trim().split(/\s+/).slice(-1)[0] || session.displayName : "";

  /* ═══════════ LOADING STATE ═══════════ */
  if (loading) {
    return (
      <section className="disc-page">
        <SkeletonHero />
        <SkeletonCards count={6} />
        <SkeletonList count={5} />
        <SkeletonCards count={4} />
      </section>
    );
  }

  /* ═══════════ MAIN RENDER ═══════════ */
  return (
    <section className="disc-page">
      {/* Botanical decorations */}
      <div className="disc-deco disc-deco-tl"><Vine size={56} /></div>
      <div className="disc-deco disc-deco-tr"><Flower size={22} /></div>
      <div className="disc-deco disc-deco-br"><RoseCluster size={36} /></div>

      {/* ── HERO ── */}
      <Section delay={0}>
        <div className="disc-hero">
          <div className="disc-hero-content">
            <span className="disc-hero-eyebrow">KHÁM PHÁ</span>
            <h1 className="disc-hero-title">{greeting}{firstName ? `, ${firstName}` : ""}</h1>
            <p className="disc-hero-sub">Cùng 4ANG tìm kiếm giai điệu phù hợp với bạn hôm nay.</p>
          </div>
          <div className="disc-hero-visual">
            <Headphones size={52} strokeWidth={1} style={{ color: "var(--c-sage)", opacity: 0.3 }} />
          </div>
        </div>
      </Section>

      {/* ── QUICK PICKS ── */}
      {quickPicks.length > 0 && (
        <Section delay={0.08} className="disc-section">
          <div className="disc-section-head">
            <h2>NHANH CHO BẠN</h2>
            <span className="disc-section-sub">Chọn nghe không cần suy nghĩ</span>
          </div>
          <div className="disc-quick-wrap">
            <ScrollArrows containerRef={quickPickRef} />
            <div className="disc-quick-scroll" ref={quickPickRef}>
              {quickPicks.map((t, i) => (
                <button
                  key={t.id}
                  className={"disc-quick-card" + (isCur(t) ? " disc-quick-active" : "")}
                  onClick={() => playFrom(displayRecs.length ? displayRecs : displayTrending, i)}
                >
                  <div
                    className="disc-quick-art"
                    style={t.coverUrl
                      ? { backgroundImage: `url('${t.coverUrl}')` }
                      : { background: gradientFor(hashHue(t.title)) }
                    }
                  >
                    <div className="disc-quick-play-hint">
                      {isCur(t) && isPlaying ? <Pause size={18} fill="white" /> : <Play size={18} fill="white" />}
                    </div>
                  </div>
                  <div className="disc-quick-info">
                    <span className="disc-quick-title">{t.title}</span>
                    <span className="disc-quick-artist">{artistName(t)}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </Section>
      )}

      {/* ── RECOMMENDATIONS / DÀNH CHO BẠN ── */}
      {displayRecs.length > 0 && (
        <Section delay={0.12} className="disc-section">
          <div className="disc-section-head">
            <h2>DÀNH CHO BẠN</h2>
            <span className="disc-section-sub">Dựa trên gu nghe nhạc của bạn</span>
          </div>
          <div className="disc-song-list">
            {displayRecs.slice(0, 8).map((t, i) => (
              <div
                key={t.id}
                className={"disc-song-row" + (isCur(t) ? " disc-row-active" : "")}
                onClick={() => playFrom(displayRecs, i)}
              >
                <span className="disc-rank">{isCur(t) && isPlaying
                  ? <span className="disc-eq"><span /><span /><span /></span>
                  : (i + 1)}</span>
                <div
                  className="disc-row-art"
                  style={t.coverUrl
                    ? { backgroundImage: `url('${t.coverUrl}')` }
                    : { background: gradientFor(hashHue(t.title)) }
                  }
                />
                <div className="disc-row-info">
                  <div className="disc-row-title">{t.title}</div>
                  <div className="disc-row-artist">
                    {onOpenArtist && t.uploaderUsername ? (
                      <span className="disc-artist-link" onClick={(e) => { e.stopPropagation(); onOpenArtist(t.uploaderUsername); }}>
                        {artistName(t)}
                      </span>
                    ) : artistName(t)}
                  </div>
                </div>
                <span className="disc-row-dur"><Clock size={11} /> {formatTime(t.duration || 0)}</span>
                <button
                  className="disc-row-play"
                  aria-label="Play"
                  onClick={(e) => { e.stopPropagation(); playFrom(displayRecs, i); }}
                >
                  <Play size={14} fill="currentColor" />
                </button>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── TRENDING ── */}
      {displayTrending.length > 0 && (
        <Section delay={0.16} className="disc-section">
          <div className="disc-section-head">
            <h2>ĐANG NỔI</h2>
            <span className="disc-section-sub">Bài hát được quan tâm nhiều nhất</span>
          </div>
          <div className="disc-trending-grid">
            {displayTrending.slice(0, 5).map((t, i) => (
              <div
                key={t.id}
                className="disc-trending-card"
                onClick={() => playFrom(displayTrending, i)}
              >
                <div className="disc-trending-num">#{i + 1}</div>
                <div
                  className="disc-trending-art"
                  style={t.coverUrl
                    ? { backgroundImage: `url('${t.coverUrl}')` }
                    : { background: gradientFor(hashHue(t.title)) }
                  }
                >
                  <div className="disc-trending-overlay">
                    {isCur(t) && isPlaying ? <Pause size={20} fill="white" /> : <Play size={20} fill="white" />}
                  </div>
                </div>
                <div className="disc-trending-info">
                  <div className="disc-trending-title">{t.title}</div>
                  <div className="disc-trending-artist">{artistName(t)}</div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── NEW RELEASES — artwork grid ── */}
      {displayNew.length > 0 && (
        <Section delay={0.2} className="disc-section">
          <div className="disc-section-head">
            <h2>MỚI PHÁT HÀNH</h2>
            <span className="disc-section-sub">Nội dung mới nhất trên 4ANG</span>
          </div>
          <div className="disc-new-wrap">
            <ScrollArrows containerRef={newReleaseRef} />
            <div className="disc-new-scroll" ref={newReleaseRef}>
              {displayNew.slice(0, 10).map((t, i) => (
                <div
                  key={t.id}
                  className="disc-new-card"
                  onClick={() => playFrom(displayNew, i)}
                >
                  <div
                    className="disc-new-art"
                    style={t.coverUrl
                      ? { backgroundImage: `url('${t.coverUrl}')` }
                      : { background: gradientFor(hashHue(t.title)) }
                    }
                  >
                    <div className="disc-new-overlay">
                      {isCur(t) && isPlaying ? <Pause size={20} fill="white" /> : <Play size={20} fill="white" />}
                    </div>
                  </div>
                  <div className="disc-new-title">{t.title}</div>
                  <div className="disc-new-artist">{artistName(t)}</div>
                </div>
              ))}
            </div>
          </div>
        </Section>
      )}

      {/* ── RISING ARTISTS ── */}
      {risingArtists.length > 0 && (
        <Section delay={0.24} className="disc-section">
          <div className="disc-section-head">
            <h2>NGHỆ SĨ ĐANG LÊN</h2>
            <span className="disc-section-sub">Những giọng hát đáng để lắng nghe</span>
          </div>
          <div className="disc-artist-scroll">
            {risingArtists.map((a) => (
              <div
                key={a.username}
                className="disc-artist-card"
                onClick={() => onOpenArtist && onOpenArtist(a.username)}
              >
                <div
                  className="disc-artist-avatar"
                  style={a.avatarUrl ? { backgroundImage: `url('${a.avatarUrl}')` } : {}}
                >
                  {!a.avatarUrl && <Users size={22} style={{ color: "var(--text-faint)" }} />}
                  {a.verified && <span className="disc-artist-badge">✓</span>}
                </div>
                <div className="disc-artist-name">{a.artistName}</div>
                <div className="disc-artist-meta">{a.followers || 0} người theo dõi</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── BECAUSE YOU LISTENED ── */}
      {becauseYouListened.length > 0 && (
        <Section delay={0.28} className="disc-section">
          <div className="disc-section-head">
            <h2>VÌ BẠN ĐÃ NGHE</h2>
            <span className="disc-section-sub">Dựa trên những gì bạn vừa thưởng thức</span>
          </div>
          <div className="disc-song-list">
            {becauseYouListened.slice(0, 6).map((t, i) => (
              <div
                key={t.id}
                className={"disc-song-row" + (isCur(t) ? " disc-row-active" : "")}
                onClick={() => playFrom(becauseYouListened, i)}
              >
                <span className="disc-rank">{isCur(t) && isPlaying
                  ? <span className="disc-eq"><span /><span /><span /></span>
                  : (i + 1)}</span>
                <div
                  className="disc-row-art"
                  style={t.coverUrl
                    ? { backgroundImage: `url('${t.coverUrl}')` }
                    : { background: gradientFor(hashHue(t.title)) }
                  }
                />
                <div className="disc-row-info">
                  <div className="disc-row-title">{t.title}</div>
                  <div className="disc-row-artist">{artistName(t)}</div>
                </div>
                <span className="disc-row-dur"><Clock size={11} /> {formatTime(t.duration || 0)}</span>
                <button
                  className="disc-row-play"
                  aria-label="Play"
                  onClick={(e) => { e.stopPropagation(); playFrom(becauseYouListened, i); }}
                >
                  <Play size={14} fill="currentColor" />
                </button>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── MOOD ── */}
      <Section delay={0.32} className="disc-section">
        <div className="disc-section-head">
          <h2>TÂM TRẠNG</h2>
          <span className="disc-section-sub">Chọn không gian phù hợp</span>
        </div>
        <div className="disc-mood-grid">
          {MOODS.map((m) => (
            <button
              key={m.id}
              className="disc-mood-card"
              style={{ background: m.gradient }}
              onClick={() => onOpenGenre && onOpenGenre(m.title + (m.sub ? " " + m.sub : ""))}
            >
              <span className="disc-mood-emoji">{m.emoji}</span>
              <div className="disc-mood-text">
                <div className="disc-mood-title">{m.title}</div>
                {m.sub && <div className="disc-mood-sub">{m.sub}</div>}
              </div>
              <div className="disc-mood-shimmer" />
            </button>
          ))}
        </div>
      </Section>

      {/* ── GENRES ── */}
      {allGenres.length > 0 && (
        <Section delay={0.36} className="disc-section">
          <div className="disc-section-head">
            <h2>THỂ LOẠI</h2>
            <span className="disc-section-sub">Khám phá theo sở thích</span>
          </div>
          <div className="disc-genre-chips">
            {allGenres.map((g) => (
              <button key={g.name} className="disc-genre-chip" onClick={() => onOpenGenre && onOpenGenre(g.name)}>
                {g.name}
              </button>
            ))}
          </div>
        </Section>
      )}

      {/* ── EMPTY STATE (no data at all) ── */}
      {!loading && displayTrending.length === 0 && displayNew.length === 0 && displayRecs.length === 0 && (
        <div className="disc-empty">
          <Sparkles size={40} strokeWidth={1} style={{ color: "var(--c-sage)", opacity: 0.3 }} />
          <h3>Khám phá âm nhạc trên 4ANG</h3>
          <p>Bắt đầu nghe để 4ANG hiểu gu của bạn.</p>
        </div>
      )}

      {/* ── Bottom divider ── */}
      <div className="disc-bottom-line" />
    </section>
  );
}
