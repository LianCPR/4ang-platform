import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { ArrowRight, Music, ChevronLeft, ChevronRight, Clock, TrendingUp, Headphones, Disc3, Heart } from "lucide-react";
import { motion } from "framer-motion";
import { Butterfly, Vine, RoseCluster, Flower, Bird, Petal } from "../assets/Botanical";
import { greeting, gradientFor, hashHue } from "../lib/format";
import TrackCard from "../components/TrackCard";
import { api } from "../api";
import SmartMixRail from "../components/SmartMixRail";
import ErrorState from "../components/ErrorState";

/* ─── Fade-in section wrapper ──────────────────────────────── */
function FadeSection({ children, delay = 0, className = "" }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {children}
    </motion.div>
  );
}

/* ─── Banner Carousel ───────────────────────────────────────── */
function BannerCarousel({ tracks, onPlay }) {
  const [current, setCurrent] = useState(0);
  const timerRef = useRef(null);
  const touchStartX = useRef(0);

  const banners = useMemo(() => {
    if (!tracks || tracks.length === 0) return [];
    return tracks
      .filter((t) => t.coverUrl)
      .slice(0, 5)
      .map((t) => ({
        track: t,
        title: t.title,
        artist: (t.credits && t.credits[0] && t.credits[0].artistName) || t.composer || t.uploaderDisplayName,
        hue: hashHue(t.title),
        coverUrl: t.coverUrl,
      }));
  }, [tracks]);

  const next = useCallback(() => {
    if (banners.length === 0) return;
    setCurrent((c) => (c + 1) % banners.length);
  }, [banners.length]);

  const prev = useCallback(() => {
    if (banners.length === 0) return;
    setCurrent((c) => (c - 1 + banners.length) % banners.length);
  }, [banners.length]);

  useEffect(() => {
    if (banners.length <= 1) return;
    timerRef.current = setInterval(next, 5000);
    return () => clearInterval(timerRef.current);
  }, [next, banners.length]);

  function resetTimer() {
    clearInterval(timerRef.current);
    if (banners.length > 1) timerRef.current = setInterval(next, 5000);
  }

  function handleTouchStart(e) { touchStartX.current = e.touches[0].clientX; }
  function handleTouchEnd(e) {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) { diff > 0 ? next() : prev(); resetTimer(); }
  }

  if (banners.length === 0) return null;

  return (
    <div className="banner-carousel" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div className="banner-track" style={{ transform: `translateX(-${current * 100}%)` }}>
        {banners.map((b) => (
          <div key={b.track.id} className="banner-slide" onClick={() => {
            const idx = tracks.findIndex((t) => t.id === b.track.id);
            if (idx >= 0) onPlay(tracks, idx);
          }}>
            <div className="banner-bg" style={{ backgroundImage: `url('${b.coverUrl}')` }} />
            <div className="banner-overlay" />
            <div className="banner-content">
              <span className="banner-label">FEATURED</span>
              <h2 className="banner-title">{b.title}</h2>
              <p className="banner-artist">{b.artist}</p>
              <button className="banner-play-btn">▶ PLAY</button>
            </div>
          </div>
        ))}
      </div>
      {banners.length > 1 && (
        <>
          <button className="banner-nav banner-prev" onClick={(e) => { e.stopPropagation(); prev(); resetTimer(); }}>
            <ChevronLeft size={20} />
          </button>
          <button className="banner-nav banner-next" onClick={(e) => { e.stopPropagation(); next(); resetTimer(); }}>
            <ChevronRight size={20} />
          </button>
          <div className="banner-dots">
            {banners.map((_, i) => (
              <button key={i} className={'banner-dot' + (i === current ? ' active' : '')} onClick={(e) => { e.stopPropagation(); setCurrent(i); resetTimer(); }} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Mood Data ──────────────────────────────────────────── */
const MOODS = [
  { id: "morning", title: "Buổi sáng\ndịu dàng", icon: "☀", gradient: "linear-gradient(135deg, #f5d785 0%, #e8a849 50%, #d4915e 100%)", songCount: 24 },
  { id: "sunset", title: "Chill\nhoàng hôn", icon: "🌅", gradient: "linear-gradient(135deg, #e8926f 0%, #c06b5e 50%, #8b4a6b 100%)", songCount: 18 },
  { id: "rain", title: "Những ngày\nmưa", icon: "🌧", gradient: "linear-gradient(135deg, #7a9eb5 0%, #5b7f95 50%, #3d5f72 100%)", songCount: 31 },
  { id: "night", title: "Đêm\nmuộn", icon: "🌙", gradient: "linear-gradient(135deg, #4a4570 0%, #2d2b55 50%, #1a1838 100%)", songCount: 22 },
  { id: "focus", title: "Tập trung\nhọc tập", icon: "📖", gradient: "linear-gradient(135deg, #6b8f71 0%, #4d7251 50%, #3a5a3f 100%)", songCount: 15 },
  { id: "relax", title: "Thư\ngiãn", icon: "🍃", gradient: "linear-gradient(135deg, #a8c5a0 0%, #7da876 50%, #5d8a58 100%)", songCount: 20 },
  { id: "love", title: "Lãng\nmạn", icon: "💕", gradient: "linear-gradient(135deg, #d4869c 0%, #b86b82 50%, #8e4f68 100%)", songCount: 27 },
  { id: "energy", title: "Năng\nlượng", icon: "⚡", gradient: "linear-gradient(135deg, #e8a849 0%, #d4883a 50%, #b86e2c 100%)", songCount: 19 },
];

export default function HomePage({
  tracks, recentlyPlayedTracks, continueListeningTracks, session, current, isPlaying, progress,
  followedUsernames,
  onPlay, onLike, onSave, onShare, onComment, onLyrics, onAddToPlaylist, onOpenArtist,
}) {
  const firstName = (session.displayName || "").trim().split(/\s+/).slice(-1)[0] || session.displayName;

  const trending = useMemo(() => {
    return tracks
      .map((t) => ({ t, score: t.likedBy.length * 2 + t.shareCount * 3 + (t.playCount || 0) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map((x) => x.t);
  }, [tracks]);

  const featured = trending[0] || tracks[0] || null;
  const featuredIsCurrent = !!current && !!featured && current.trackId === featured.id;
  const featuredArtist = featured ? (featured.credits && featured.credits[0] && featured.credits[0].artistName) || featured.composer || featured.uploaderDisplayName : "";

  const hasTracks = tracks.length > 0;

  // Recently played tracks
  const recentTracks = useMemo(() => {
    if (!recentlyPlayedTracks || recentlyPlayedTracks.length === 0) return [];
    const seen = new Set();
    return recentlyPlayedTracks.filter((t) => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    }).slice(0, 6);
  }, [recentlyPlayedTracks]);

  // Genres from API (show all available genres, not just from tracks)
  const [apiGenres, setApiGenres] = useState([]);
  const [genresError, setGenresError] = useState(null);
  useEffect(() => {
    api.discoverGenres()
      .then((d) => { setApiGenres(d.genres || []); setGenresError(null); })
      .catch((e) => { setGenresError(e.message); });
  }, []);
  const allGenres = useMemo(() => {
    if (apiGenres.length > 0) return apiGenres.map((g) => g.name || g);
    return [...new Set(tracks.flatMap((t) => t.genres || []))].slice(0, 8);
  }, [apiGenres, tracks]);

  return (
    <div className="home-page">
      {/* Botanical decorations */}
      <div className="home-botanical home-botanical-tl">
        <Vine size={100} direction="right" />
        <Flower size={28} style={{ opacity: 0.18, color: "var(--c-rose)", position: "absolute", top: 30, left: 40 }} />
      </div>
      <div className="home-botanical home-botanical-tr">
        <Butterfly size={22} style={{ opacity: 0.2, color: "var(--c-sage)" }} />
      </div>
      <div className="home-botanical home-botanical-br">
        <RoseCluster size={50} />
      </div>
      <div className="home-botanical home-botanical-bl">
        <Petal size={14} rotation={-20} style={{ opacity: 0.12, color: "var(--c-rose)" }} />
        <Bird size={18} style={{ opacity: 0.12, color: "var(--c-sage)", marginTop: 8 }} />
      </div>

      {/* Banner Carousel */}
      <FadeSection delay={0}>
        <BannerCarousel tracks={tracks} onPlay={onPlay} />
      </FadeSection>

      {/* ─── HERO + FEATURED RELEASE ─── */}
      <div className="home-hero-row">
        <div className="home-hero">
          <div className="home-hero-text">
            <span className="home-greeting">{greeting()}, {firstName} ☀</span>
            <h1 className="home-hero-title">
              Let the<br />
              music<br />
              brighten<br />
              your day.
            </h1>
            <p className="home-hero-subtitle">Every song is a postcard<br />from someone's heart.</p>
            {hasTracks && (
              <button type="button" className="home-hero-btn" onClick={() => onPlay(tracks, 0)}>
                EXPLORE NOW <ArrowRight size={16} />
              </button>
            )}
          </div>
          <div className="home-hero-butterfly">
            <Butterfly size={28} style={{ opacity: 0.25, color: "var(--c-sage)" }} />
          </div>
        </div>

        {featured && (
          <div className="home-featured">
            <span className="home-featured-label">FEATURED RELEASE</span>
            <div className="home-featured-card" onClick={() => {
              const idx = tracks.findIndex((t) => t.id === featured.id);
              if (idx >= 0) onPlay(tracks, idx);
            }}>
              <div
                className="home-featured-art"
                style={featured.coverUrl
                  ? { backgroundImage: "url('" + featured.coverUrl + "')" }
                  : { background: gradientFor(hashHue(featured.title)) }
                }
              >
                <div className="home-featured-overlay">
                  <div className="home-featured-art-title">{featured.title}</div>
                  <div className="home-featured-art-artist">{featuredArtist}</div>
                </div>
                <button type="button" className="home-featured-play" aria-label={featuredIsCurrent && isPlaying ? "Tạm dừng" : "Phát"}>
                  <span className="home-featured-play-icon">▶</span>
                  <span>PLAY NOW</span>
                </button>
              </div>
              <div className="home-featured-botanical-tl"><Flower size={22} style={{ opacity: 0.15, color: "var(--c-rose)" }} /></div>
              <div className="home-featured-botanical-br"><Bird size={18} style={{ opacity: 0.12, color: "var(--c-sage)" }} /></div>
            </div>
          </div>
        )}
      </div>

      {/* ─── EDITORIAL QUOTE ─── */}
      <FadeSection delay={0.15} className="home-section">
        <div className="home-editorial-quote">
          <div className="home-editorial-ornament"><Flower size={20} style={{ opacity: 0.25, color: "var(--c-rose)" }} /></div>
          <blockquote>
            "Âm nhạc là ngôn ngữ mà qua đó tâm hồn có thể nói mà không cần từ ngữ."
          </blockquote>
          <cite>— George Sand</cite>
        </div>
      </FadeSection>

      {/* ─── CONTINUE LISTENING ─── */}
      {continueListeningTracks && continueListeningTracks.length > 0 && (
        <FadeSection delay={0.15} className="home-section">
          <div className="home-section-header">
            <div className="home-section-title-row">
              <Play size={16} style={{ color: "var(--text-faint)" }} />
              <h2>TIẾP TỤC NGHE</h2>
            </div>
          </div>
          <div className="home-recent-list">
            {continueListeningTracks.slice(0, 4).map((item, i) => {
              const pct = item.durationSeconds > 0 ? Math.round((item.progressSeconds / item.durationSeconds) * 100) : 0;
              return (
                <button key={item.id + '-cl'} type="button" className="home-recent-item" onClick={() => { /* play and seek */ }}>
                  <div className="home-recent-art" style={item.coverUrl ? { backgroundImage: "url('" + item.coverUrl + "')" } : { background: gradientFor(hashHue(item.title)) }} />
                  <div className="home-recent-info">
                    <div className="home-recent-title">{item.title}</div>
                    <div className="home-recent-artist">{item.artistName}</div>
                    <div className="home-recent-progress"><div className="home-recent-bar" style={{ width: pct + '%' }} /></div>
                  </div>
                </button>
              );
            })}
          </div>
        </FadeSection>
      )}

      {/* ─── RECENTLY PLAYED ─── */}
      {recentTracks.length > 0 && (
        <FadeSection delay={0.2} className="home-section">
          <div className="home-section-header">
            <div className="home-section-title-row">
              <Clock size={16} style={{ color: "var(--text-faint)" }} />
              <h2>NGHE GẦN ĐÂY</h2>
            </div>
            <button type="button" className="link-btn view-all-btn">VIEW ALL</button>
          </div>
          <div className="home-recent-list">
            {recentTracks.map((t, i) => {
              const artist = (t.credits && t.credits[0] && t.credits[0].artistName) || t.composer || t.uploaderDisplayName;
              const isCur = !!current && current.trackId === t.id;
              return (
                <div key={t.id + "-recent-" + i} className={"home-recent-item" + (isCur ? " home-recent-active" : "")}
                  onClick={() => {
                    const idx = tracks.findIndex((tr) => tr.id === t.id);
                    if (idx >= 0) onPlay(tracks, idx);
                  }}
                >
                  <div className="home-recent-art" style={t.coverUrl ? { backgroundImage: `url('${t.coverUrl}')` } : { background: gradientFor(hashHue(t.title)) }}>
                    <div className="home-recent-art-overlay">
                      <Disc3 size={16} className={isCur && isPlaying ? "spin" : ""} />
                    </div>
                  </div>
                  <div className="home-recent-info">
                    <div className="home-recent-title">{t.title}</div>
                    <div className="home-recent-artist">{artist}</div>
                  </div>
                  <div className="home-recent-actions">
                    <button type="button" className="icon-btn mini-like" onClick={(e) => { e.stopPropagation(); onLike(t.id); }} aria-label="Thích">
                      <Heart size={14} fill={t.likedBy.includes(session.username) ? "currentColor" : "none"} className={t.likedBy.includes(session.username) ? "active active-wine" : ""} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </FadeSection>
      )}

      {/* ─── SMART MIX ─── */}
      <FadeSection delay={0.22}>
        <SmartMixRail
          type="my-mix"
          title="Dành riêng cho bạn"
          subtitle="Dựa trên sở thích nghe nhạc của bạn"
          current={current} isPlaying={isPlaying}
          onPlay={onPlay} onLike={onLike}
        />
      </FadeSection>

      {/* ─── NEW ON 4ANG ─── */}
      <FadeSection delay={0.25} className="home-section">
        <div className="home-section-header">
          <div className="home-section-title-row">
            <TrendingUp size={16} style={{ color: "var(--text-faint)" }} />
            <h2>MỚI TRÊN 4ANG</h2>
          </div>
          <button type="button" className="link-btn view-all-btn">VIEW ALL</button>
        </div>
        {hasTracks ? (
          <div className="home-music-grid">
            {tracks.slice(0, 5).map((t, i) => (
              <TrackCard key={t.id} track={t} session={session} index={i}
                isCurrent={!!current && current.trackId === t.id} isPlaying={isPlaying} progress={progress}
                onPlay={() => onPlay(tracks, i)}
                onLike={() => onLike(t.id)} onSave={() => onSave(t.id)}
                onShare={() => onShare(t)} onComment={() => onComment(t.id)} onLyrics={() => onLyrics(t.id)}
                onAddToPlaylist={onAddToPlaylist} onOpenArtist={onOpenArtist}
              />
            ))}
          </div>
        ) : (
          <div className="home-empty-section">
            <Music size={28} style={{ opacity: 0.15, color: "var(--c-sage)" }} />
            <h3>Chưa có bài hát nào</h3>
            <p>Hãy là người đầu tiên chia sẻ âm nhạc trên 4ANG.</p>
          </div>
        )}
      </FadeSection>

      {/* ─── FOR YOU — MORE TRACKS ─── */}
      {hasTracks && tracks.length > 5 && (
        <FadeSection delay={0.3} className="home-section">
          <div className="home-section-header">
            <div className="home-section-title-row">
              <Headphones size={16} style={{ color: "var(--text-faint)" }} />
              <h2>DÀNH CHO BẠN</h2>
            </div>
            <button type="button" className="link-btn view-all-btn">VIEW ALL</button>
          </div>
          <div className="home-music-grid">
            {tracks.slice(5, 10).map((t, i) => (
              <TrackCard key={t.id} track={t} session={session} index={i + 5}
                isCurrent={!!current && current.trackId === t.id} isPlaying={isPlaying} progress={progress}
                onPlay={() => onPlay(tracks, i + 5)}
                onLike={() => onLike(t.id)} onSave={() => onSave(t.id)}
                onShare={() => onShare(t)} onComment={() => onComment(t.id)} onLyrics={() => onLyrics(t.id)}
                onAddToPlaylist={onAddToPlaylist}
              />
            ))}
          </div>
        </FadeSection>
      )}

      {/* ─── DISCOVER GENRES ─── */}
      {allGenres.length > 0 && (
        <FadeSection delay={0.35} className="home-section">
          <div className="home-section-header">
            <h2>THỂ LOẠI</h2>
          </div>
          <div className="genre-chip-row">
            {allGenres.map((g) => (
              <button key={g} type="button" className="genre-chip">{g}</button>
            ))}
          </div>
          {genresError && (
            <ErrorState message="Không thể tải thể loại." compact onRetry={() => {
              api.discoverGenres().then((d) => { setApiGenres(d.genres || []); setGenresError(null); }).catch((e) => { setGenresError(e.message); });
            }} />
          )}
        </FadeSection>
      )}

      {/* ─── BOTTOM DECORATIVE DIVIDER ─── */}
      <div className="home-bottom-divider">
        <Flower size={16} style={{ opacity: 0.15, color: "var(--c-rose)" }} />
        <div className="home-bottom-line" />
        <Bird size={14} style={{ opacity: 0.12, color: "var(--c-sage)" }} />
      </div>
    </div>
  );
}
