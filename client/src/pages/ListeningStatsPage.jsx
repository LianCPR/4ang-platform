import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { BarChart3, Clock, Music, User, Mic2, Calendar, Hash, Activity, Headphones } from "lucide-react";
import { api } from "../api";
import { gradientFor, hashHue } from "../lib/format";
import ArtistBadge from "../components/ArtistBadge";

const PERIODS = [
  { days: 7, label: "7 ngày" },
  { days: 30, label: "30 ngày" },
  { days: 90, label: "90 ngày" },
  { days: 365, label: "1 năm" },
];

function StatCard({ icon: Icon, label, value, sub, color }) {
  return (
    <motion.div className="ls-stat-card" whileHover={{ y: -2 }}>
      <div className="ls-stat-icon" style={{ color: color || "var(--c-sage)" }}>
        <Icon size={20} />
      </div>
      <div className="ls-stat-value">{value}</div>
      <div className="ls-stat-label">{label}</div>
      {sub && <div className="ls-stat-sub">{sub}</div>}
    </motion.div>
  );
}

export default function ListeningStatsPage({ onOpenArtist }) {
  const [period, setPeriod] = useState(30);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  function loadStats() {
    setLoading(true);
    setError(null);
    api.listeningStats(period).then((data) => {
      setStats(data);
      setLoading(false);
    }).catch((e) => {
      setError(e.message || "Không thể tải dữ liệu thống kê.");
      setStats(null);
      setLoading(false);
    });
  }

  useEffect(() => { loadStats(); }, [period]);

  const formatMinutes = (m) => {
    if (m < 60) return m + " phút";
    const hours = Math.floor(m / 60);
    const mins = m % 60;
    if (hours < 24) return `${hours}h ${mins}m`;
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return `${days}d ${remHours}h`;
  };

  return (
    <div className="ls-page">
      <motion.div
        className="ls-hero"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="ls-hero-decor">
          <Headphones size={100} strokeWidth={0.5} />
        </div>
        <p className="ls-hero-eyebrow">YOUR LISTENING</p>
        <h1 className="ls-hero-title">Thống kê nghe nhạc</h1>
        <p className="ls-hero-subtitle">Khám phá thói quen nghe nhạc của bạn trên 4ANG</p>
      </motion.div>

      {/* Period selector */}
      <div className="ls-period-tabs">
        {PERIODS.map((p) => (
          <button
            key={p.days}
            type="button"
            className={`ls-period-tab ${period === p.days ? "active" : ""}`}
            onClick={() => setPeriod(p.days)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="ls-loading">
          <div className="ls-skeleton-grid">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="ls-skeleton-card" />
            ))}
          </div>
        </div>
      ) : stats ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {/* Main stats grid */}
          <div className="ls-stats-grid">
            <StatCard
              icon={Clock}
              label="Tổng thời gian"
              value={formatMinutes(stats.totalMinutes || 0)}
              color="var(--c-sage-deep)"
            />
            <StatCard
              icon={Activity}
              label="Tổng lượt nghe"
              value={(stats.totalPlays || 0).toLocaleString()}
              color="var(--c-gold)"
            />
            <StatCard
              icon={User}
              label="Nghệ sĩ đã nghe"
              value={stats.uniqueArtistsCount || 0}
              color="var(--c-rose)"
            />
            <StatCard
              icon={Calendar}
              label="Ngày hoạt động nhiều nhất"
              value={stats.mostActiveDay || "—"}
              color="var(--c-brown)"
            />
          </div>

          {/* Top items */}
          <div className="ls-top-sections">
            {stats.topArtist && (
              <motion.div className="ls-top-card" whileHover={{ y: -2 }}>
                <div className="ls-top-label">
                  <Mic2 size={14} /> Nghệ sĩ yêu thích
                </div>
                <div className="ls-top-content">
                  <div
                    className="ls-top-avatar"
                    style={stats.topArtist.avatarUrl ? { backgroundImage: `url('${stats.topArtist.avatarUrl}')` } : { background: gradientFor(hashHue(stats.topArtist.artistName)) }}
                  />
                  <div className="ls-top-info">
                    <div className="ls-top-name" onClick={() => onOpenArtist && onOpenArtist(stats.topArtist.username)}>
                      {stats.topArtist.artistName}
                      <ArtistBadge badge={stats.topArtist.badge} size={12} />
                    </div>
                    <div className="ls-top-meta">{stats.topArtist.plays} lượt nghe</div>
                  </div>
                </div>
              </motion.div>
            )}

            {stats.topTrack && (
              <motion.div className="ls-top-card" whileHover={{ y: -2 }}>
                <div className="ls-top-label">
                  <Music size={14} /> Bài hát yêu thích
                </div>
                <div className="ls-top-content">
                  <div
                    className="ls-top-art"
                    style={stats.topTrack.coverUrl ? { backgroundImage: `url('${stats.topTrack.coverUrl}')` } : { background: gradientFor(hashHue(stats.topTrack.title)) }}
                  />
                  <div className="ls-top-info">
                    <div className="ls-top-name">{stats.topTrack.title}</div>
                    <div className="ls-top-meta">
                      {stats.topTrack.credits?.[0]?.artistName || stats.topTrack.composer || stats.topTrack.uploaderDisplayName}
                      {stats.topTrack.playsInRange && ` · ${stats.topTrack.playsInRange} lượt`}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {stats.topGenre && (
              <motion.div className="ls-top-card" whileHover={{ y: -2 }}>
                <div className="ls-top-label">
                  <Hash size={14} /> Thể loại yêu thích
                </div>
                <div className="ls-top-content">
                  <div className="ls-top-genre-chip">{stats.topGenre.name}</div>
                  <div className="ls-top-info">
                    <div className="ls-top-meta">{stats.topGenre.plays} lượt nghe trong {stats.days} ngày</div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {stats.totalPlays === 0 && (
            <div className="ls-empty">
              <Headphones size={48} style={{ color: "var(--c-sage)", opacity: 0.3 }} />
              <p>Chưa đủ dữ liệu nghe nhạc.</p>
              <p className="ls-empty-sub">Bắt đầu nghe nhạc để xem thống kê của bạn.</p>
            </div>
          )}
        </motion.div>
      ) : error ? (
        <div className="ls-empty">
          <BarChart3 size={48} style={{ color: "var(--danger)", opacity: 0.3 }} />
          <p>{error}</p>
          <button type="button" className="btn-secondary" onClick={loadStats} style={{ marginTop: "var(--sp-2)" }}>Thử lại</button>
        </div>
      ) : (
        <div className="ls-empty">
          <BarChart3 size={48} style={{ color: "var(--c-sage)", opacity: 0.3 }} />
          <p>Không thể tải dữ liệu thống kê.</p>
        </div>
      )}
    </div>
  );
}
