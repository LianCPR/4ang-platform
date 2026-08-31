import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Compass, TrendingUp, Flame, Music2, Users, Disc3, BarChart3, ArrowRight, Play, Pause, Heart, Clock } from "lucide-react";
import { api } from "../api";
import { gradientFor, hashHue, formatTime } from "../lib/format";
import ArtistBadge from "../components/ArtistBadge";
import TrackCard from "../components/TrackCard";

const GENRE_COLORS = [
  "linear-gradient(135deg, #9AA68A 0%, #6F8066 100%)",
  "linear-gradient(135deg, #D9A3A0 0%, #C08583 100%)",
  "linear-gradient(135deg, #D8B46A 0%, #C9A76B 100%)",
  "linear-gradient(135deg, #EBC6A8 0%, #D8B46A 100%)",
  "linear-gradient(135deg, #715A45 0%, #8B7355 100%)",
  "linear-gradient(135deg, #9AA68A 0%, #D8B46A 100%)",
  "linear-gradient(135deg, #D9A3A0 0%, #EBC6A8 100%)",
  "linear-gradient(135deg, #6F8066 0%, #9AA68A 100%)",
];

const TABS = [
  { id: "trending", label: "Đang hot", icon: Flame },
  { id: "charts", label: "Bảng xếp hạng", icon: BarChart3 },
  { id: "rising", label: "Nghệ sĩ mới", icon: TrendingUp },
  { id: "genres", label: "Thể loại", icon: Music2 },
];

function TrendingTrack({ track, index, current, isPlaying, onPlay }) {
  const artist = track.primaryArtistName || track.credits?.[0]?.artistName || track.composer || track.uploaderDisplayName;
  const isCurrent = current && current.trackId === track.id;

  return (
    <motion.button
      type="button"
      className="explore-trending-item"
      onClick={() => onPlay(null, null)}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
    >
      <span className="explore-trending-rank">{String(index + 1).padStart(2, "0")}</span>
      <div
        className="explore-trending-art"
        style={track.coverUrl ? { backgroundImage: `url('${track.coverUrl}')` } : { background: gradientFor(hashHue(track.title)) }}
      >
        <div className="explore-trending-art-overlay">
          {isCurrent && isPlaying ? <Pause size={14} /> : <Play size={14} />}
        </div>
      </div>
      <div className="explore-trending-info">
        <div className="explore-trending-title">{track.title}</div>
        <div className="explore-trending-artist">
          {artist}
          {track.uploaderBadge && <ArtistBadge badge={track.uploaderBadge} size={11} />}
        </div>
      </div>
      <span className="explore-trending-plays">
        {(track.playCount || 0).toLocaleString()} <span className="explore-trending-plays-label">lượt</span>
      </span>
    </motion.button>
  );
}

function ChartTrack({ track, index, current, isPlaying, onPlay }) {
  const artist = track.primaryArtistName || track.credits?.[0]?.artistName || track.composer || track.uploaderDisplayName;
  const isCurrent = current && current.trackId === track.id;

  return (
    <motion.div
      className="explore-chart-item"
      whileHover={{ scale: 1.01 }}
    >
      <div className="explore-chart-rank">
        {index < 3 ? (
          <span className={`explore-chart-rank-top rank-${index + 1}`}>{index + 1}</span>
        ) : (
          <span className="explore-chart-rank-num">{index + 1}</span>
        )}
      </div>
      <div
        className="explore-chart-art"
        style={track.coverUrl ? { backgroundImage: `url('${track.coverUrl}')` } : { background: gradientFor(hashHue(track.title)) }}
      />
      <div className="explore-chart-info">
        <div className="explore-chart-title">{track.title}</div>
        <div className="explore-chart-artist">{artist}</div>
      </div>
      <span className="explore-chart-duration">{formatTime(track.duration || 0)}</span>
      <button
        type="button"
        className="explore-chart-play"
        onClick={() => onPlay(null, null)}
      >
        {isCurrent && isPlaying ? <Pause size={16} /> : <Play size={16} />}
      </button>
    </motion.div>
  );
}

function ArtistCard({ artist, index }) {
  return (
    <motion.div className="explore-artist-card" whileHover={{ y: -4 }}>
      <div
        className="explore-artist-avatar"
        style={artist.avatarUrl ? { backgroundImage: `url('${artist.avatarUrl}')` } : { background: gradientFor(hashHue(artist.artistName)) }}
      >
        <ArtistBadge badge={artist.badge} size={16} className="explore-artist-badge" />
      </div>
      <div className="explore-artist-name">{artist.artistName}</div>
      <div className="explore-artist-followers">{(artist.followers || 0).toLocaleString()} người theo dõi</div>
    </motion.div>
  );
}

export default function ExplorePage({
  session, tracks, current, isPlaying, progress,
  onPlay, onLike, onSave, onShare, onComment, onLyrics, onAddToPlaylist,
  onOpenArtist, onOpenGenre,
}) {
  const [activeTab, setActiveTab] = useState("trending");
  const [trendingTracks, setTrendingTracks] = useState([]);
  const [chartData, setChartData] = useState(null);
  const [risingArtists, setRisingArtists] = useState([]);
  const [genres, setGenres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chartPeriod, setChartPeriod] = useState(30);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.trending(20, 30).catch(() => ({ tracks: [] })),
      api.risingArtists(10).catch(() => ({ artists: [] })),
      api.discoverGenres().catch(() => ({ genres: [] })),
      api.charts(chartPeriod).catch(() => ({ topSongs: [], topArtists: [] })),
    ]).then(([t, r, g, c]) => {
      setTrendingTracks(t.tracks || []);
      setRisingArtists(r.artists || []);
      setGenres(g.genres || []);
      setChartData(c);
      setLoading(false);
    });
  }, [chartPeriod]);

  const handlePlayTrack = (track, index) => {
    if (trendingTracks.length > 0) onPlay(trendingTracks, trendingTracks.indexOf(track));
  };

  return (
    <div className="explore-page">
      {/* Hero */}
      <motion.div
        className="explore-hero"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="explore-hero-decor">
          <Compass size={120} strokeWidth={0.5} />
        </div>
        <p className="explore-hero-eyebrow">EXPLORE</p>
        <h1 className="explore-hero-title">Khám phá thế giới âm nhạc</h1>
        <p className="explore-hero-subtitle">
          Tìm kiếm nghệ sĩ mới, khám phá trending và theo dõi bảng xếp hạng trên 4ANG
        </p>
      </motion.div>

      {/* Tabs */}
      <div className="explore-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`explore-tab ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <tab.icon size={15} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "trending" && (
        <motion.div
          key="trending"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="explore-section-header">
            <div className="explore-section-title-row">
              <Flame size={18} className="explore-section-icon" />
              <h2>Bài hát đang hot</h2>
            </div>
            <span className="explore-section-sub">Dựa trên lượt nghe, thích và chia sẻ thực tế</span>
          </div>
          {trendingTracks.length > 0 ? (
            <div className="explore-trending-list">
              {trendingTracks.map((t, i) => (
                <TrendingTrack
                  key={t.id} track={t} index={i}
                  current={current} isPlaying={isPlaying}
                  onPlay={() => onPlay(trendingTracks, i)}
                />
              ))}
            </div>
          ) : (
            <div className="explore-empty">
              <Music2 size={40} style={{ color: "var(--c-sage)", opacity: 0.3 }} />
              <p>Chưa có dữ liệu trending.</p>
            </div>
          )}

          {/* Rising Artists mini section */}
          {risingArtists.length > 0 && (
            <div className="explore-section" style={{ marginTop: "var(--sp-7)" }}>
              <div className="explore-section-header">
                <div className="explore-section-title-row">
                  <TrendingUp size={18} className="explore-section-icon" />
                  <h2>Nghệ sĩ đang lên</h2>
                </div>
              </div>
              <div className="explore-artist-grid">
                {risingArtists.slice(0, 6).map((a, i) => (
                  <div key={a.username} onClick={() => onOpenArtist && onOpenArtist(a.username)} style={{ cursor: "pointer" }}>
                    <ArtistCard artist={a} index={i} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {activeTab === "charts" && (
        <motion.div
          key="charts"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="explore-section-header">
            <div className="explore-section-title-row">
              <BarChart3 size={18} className="explore-section-icon" />
              <h2>4ANG Charts</h2>
            </div>
            <div className="explore-period-tabs">
              {[7, 30, 90].map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`explore-period-tab ${chartPeriod === d ? "active" : ""}`}
                  onClick={() => setChartPeriod(d)}
                >
                  {d} ngày
                </button>
              ))}
            </div>
          </div>

          {chartData && chartData.topSongs && chartData.topSongs.length > 0 ? (
            <div className="explore-chart-list">
              {chartData.topSongs.map((t, i) => (
                <ChartTrack
                  key={t.id} track={t} index={i}
                  current={current} isPlaying={isPlaying}
                  onPlay={() => onPlay(chartData.topSongs, i)}
                />
              ))}
            </div>
          ) : (
            <div className="explore-empty">
              <BarChart3 size={40} style={{ color: "var(--c-sage)", opacity: 0.3 }} />
              <p>Chưa đủ dữ liệu để tạo bảng xếp hạng.</p>
            </div>
          )}

          {/* Top Artists in Charts */}
          {chartData && chartData.topArtists && chartData.topArtists.length > 0 && (
            <div className="explore-section" style={{ marginTop: "var(--sp-7)" }}>
              <div className="explore-section-header">
                <div className="explore-section-title-row">
                  <Users size={18} className="explore-section-icon" />
                  <h2>Nghệ sĩ hàng đầu</h2>
                </div>
              </div>
              <div className="explore-artist-grid">
                {chartData.topArtists.map((a, i) => (
                  <div key={a.username} onClick={() => onOpenArtist && onOpenArtist(a.username)} style={{ cursor: "pointer" }}>
                    <ArtistCard artist={a} index={i} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {activeTab === "rising" && (
        <motion.div
          key="rising"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="explore-section-header">
            <div className="explore-section-title-row">
              <TrendingUp size={18} className="explore-section-icon" />
              <h2>Nghệ sĩ đang lên trên 4ANG</h2>
            </div>
            <span className="explore-section-sub">Phát hiện tài năng mới dựa trên tăng trưởng thực</span>
          </div>
          {risingArtists.length > 0 ? (
            <div className="explore-artist-grid">
              {risingArtists.map((a, i) => (
                <div key={a.username} onClick={() => onOpenArtist && onOpenArtist(a.username)} style={{ cursor: "pointer" }}>
                  <ArtistCard artist={a} index={i} />
                </div>
              ))}
            </div>
          ) : (
            <div className="explore-empty">
              <TrendingUp size={40} style={{ color: "var(--c-sage)", opacity: 0.3 }} />
              <p>Chưa đủ dữ liệu để hiển thị nghệ sĩ đang lên.</p>
            </div>
          )}
        </motion.div>
      )}

      {activeTab === "genres" && (
        <motion.div
          key="genres"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="explore-section-header">
            <div className="explore-section-title-row">
              <Music2 size={18} className="explore-section-icon" />
              <h2>Khám phá thể loại</h2>
            </div>
          </div>
          {genres.length > 0 ? (
            <div className="explore-genre-grid">
              {genres.map((g, i) => (
                <motion.button
                  key={g.name}
                  type="button"
                  className="explore-genre-card"
                  style={{ background: GENRE_COLORS[i % GENRE_COLORS.length] }}
                  onClick={() => onOpenGenre && onOpenGenre(g.name)}
                  whileHover={{ scale: 1.03, y: -2 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <span className="explore-genre-name">{g.name}</span>
                  <span className="explore-genre-count">{g.trackCount} bài hát</span>
                </motion.button>
              ))}
            </div>
          ) : (
            <div className="explore-empty">
              <Music2 size={40} style={{ color: "var(--c-sage)", opacity: 0.3 }} />
              <p>Chưa có thể loại nào.</p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
