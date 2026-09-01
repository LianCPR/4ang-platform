import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Disc3, TrendingUp, Users, Music, Eye, Plus, Search, Filter, Clock,
  CheckCircle, XCircle, AlertCircle, MoreHorizontal, Play, Edit3, Trash2, Send,
  BarChart3, FileText, Heart, Bookmark, Activity, Calendar, LayoutDashboard,
  Upload, Settings, ExternalLink, Mic2, Headphones, Home
} from "lucide-react";
import { api } from "../api";
import { gradientFor, hashHue, formatTime, timeAgo } from "../lib/format";

const STATUS_LABELS = {
  draft: { label: "Bản nháp", icon: FileText, color: "var(--text-muted)" },
  pending_review: { label: "Chờ review", icon: Clock, color: "var(--c-gold)" },
  under_review: { label: "Đang review", icon: AlertCircle, color: "var(--c-sage)" },
  approved: { label: "Đã duyệt", icon: CheckCircle, color: "var(--success)" },
  published: { label: "Đã phát hành", icon: CheckCircle, color: "var(--c-sage-deep)" },
  rejected: { label: "Bị từ chối", icon: XCircle, color: "var(--danger)" },
};

const NAV_ITEMS = [
  { id: "overview", label: "Tổng quan", icon: LayoutDashboard },
  { id: "my-music", label: "Nhạc của tôi", icon: Music },
  { id: "analytics", label: "Phân tích", icon: BarChart3 },
];

/* ─── Stat card ──────────────────────────── */
function StatCard({ label, value, icon: Icon, accent, trend }) {
  return (
    <div className="dash-stat-card">
      <div className="dash-stat-top">
        <div className="dash-stat-icon" style={accent ? { color: accent } : {}}>
          <Icon size={18} />
        </div>
        {trend != null && (
          <span className={"dash-stat-trend" + (trend >= 0 ? " up" : " down")}>
            {trend >= 0 ? "+" : ""}{trend}%
          </span>
        )}
      </div>
      <div className="dash-stat-value">{value}</div>
      <div className="dash-stat-label">{label}</div>
    </div>
  );
}

/* ─── Mini sparkline (CSS-only bars) ────── */
function MiniSparkline({ data }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.plays), 1);
  return (
    <div className="dash-sparkline">
      {data.map((d, i) => (
        <div
          key={i}
          className="dash-sparkline-bar"
          style={{ height: `${(d.plays / max) * 100}%` }}
          title={`${d.date}: ${d.plays} lượt`}
        />
      ))}
    </div>
  );
}

/* ─── Activity row ─────────────────────── */
function ActivityRow({ play }) {
  return (
    <div className="dash-activity-row">
      <div
        className="dash-activity-art"
        style={
          play.coverUrl
            ? { backgroundImage: `url('${play.coverUrl}')` }
            : { background: gradientFor(hashHue(play.trackTitle || "")) }
        }
      />
      <div className="dash-activity-info">
        <span className="dash-activity-text">
          <strong>{play.listener || "Ai đó"}</strong> đã nghe <strong>{play.trackTitle}</strong>
        </span>
        <span className="dash-activity-time">{timeAgo(play.playedAt)}</span>
      </div>
    </div>
  );
}

/* ─── Release row ──────────────────────── */
function ReleaseRow({ release, onAction }) {
  const st = STATUS_LABELS[release.status] || STATUS_LABELS.draft;
  const StIcon = st.icon;
  return (
    <div className="dash-release-row">
      <div
        className="dash-release-art"
        style={
          release.coverUrl
            ? { backgroundImage: `url('${release.coverUrl}')` }
            : { background: gradientFor(hashHue(release.title)) }
        }
      />
      <div className="dash-release-info">
        <div className="dash-release-title">{release.title}</div>
        <div className="dash-release-meta">
          <span className="dash-release-type">{release.type}</span>
          <span className="dash-release-status" style={{ color: st.color }}>
            <StIcon size={12} /> {st.label}
          </span>
          <span className="dash-release-date">{timeAgo(release.createdAt)}</span>
        </div>
        {release.rejectionReason && (
          <div className="dash-release-reason">
            Lý do từ chối: {release.rejectionReason}
          </div>
        )}
      </div>
      <div className="dash-release-actions">
        {(release.status === "draft" || release.status === "rejected") && (
          <button type="button" className="dash-action-btn primary" onClick={() => onAction("submit", release.id)}>
            <Send size={13} /> Gửi review
          </button>
        )}
        {release.status === "draft" && (
          <button type="button" className="dash-action-btn danger" onClick={() => onAction("delete", release.id)}>
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════ */
export default function ArtistDashboardPage({ session, showToast, onClose, onOpenSubmitMusic, onOpenArtist }) {
  const [view, setView] = useState("overview");
  const [stats, setStats] = useState(null);
  const [releases, setReleases] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [statsRes, subsRes] = await Promise.all([
        api.artistStats().catch(() => null),
        api.mySubmissions().catch(() => ({ submissions: [] })),
      ]);
      if (statsRes) setStats(statsRes);
      setSubmissions(subsRes.submissions || []);
    } catch (e) { /* ignore */ }
    setLoading(false);
  }

  async function handleAction(action, id) {
    if (action === "submit") {
      try {
        await api.submitRelease(id);
        showToast("Đã gửi phát hành để review.");
        loadData();
      } catch (e) { showToast(e.message); }
    } else if (action === "delete") {
      if (!confirm("Xoá phát hành này?")) return;
      try {
        await api.deleteRelease(id);
        showToast("Đã xoá.");
        loadData();
      } catch (e) { showToast(e.message); }
    }
  }

  const allReleases = useMemo(() => {
    const subs = (submissions || []).map((s) => ({
      id: s.id,
      title: s.title,
      type: s.releaseType || "single",
      status: s.status,
      trackCount: 1,
      coverUrl: s.coverUrl,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      rejectionReason: s.adminNote,
    }));
    return subs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [submissions]);

  const filtered = allReleases.filter((r) => {
    if (filter !== "all" && r.status !== filter) return false;
    if (search && !r.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const subCounts = useMemo(() => {
    const counts = { all: allReleases.length, draft: 0, pending_review: 0, published: 0, rejected: 0 };
    for (const r of allReleases) {
      if (counts[r.status] !== undefined) counts[r.status]++;
    }
    return counts;
  }, [allReleases]);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Chào buổi sáng";
    if (h < 17) return "Chào buổi chiều";
    return "Chào buổi tối";
  })();

  return (
    <div className="dash-layout">
      {/* ── Sidebar ── */}
      <aside className="dash-sidebar">
        <div className="dash-sidebar-brand">
          <Mic2 size={18} className="c-accent" />
          <span className="dash-sidebar-brand-text">ARTIST</span>
        </div>

        <nav className="dash-sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={"dash-sidebar-item" + (view === item.id ? " active" : "")}
              onClick={() => setView(item.id)}
            >
              <item.icon size={16} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="dash-sidebar-bottom">
          <button type="button" className="dash-sidebar-item" onClick={onOpenArtist}>
            <ExternalLink size={16} />
            <span>Hồ sơ công khai</span>
          </button>
          <button type="button" className="dash-sidebar-item" onClick={onClose}>
            <Home size={16} />
            <span>Về 4ANG</span>
          </button>
        </div>

        <div className="dash-sidebar-user">
          <div className="dash-sidebar-avatar">
            {session?.username?.[0]?.toUpperCase() || "A"}
          </div>
          <div className="dash-sidebar-user-info">
            <div className="dash-sidebar-username">{session?.displayName || session?.username}</div>
            <div className="dash-sidebar-userrole">Nghệ sĩ</div>
          </div>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="dash-main">
        {/* Header */}
        <header className="dash-header">
          <div className="dash-header-left">
            <h1 className="dash-header-title">
              {view === "overview" && "Tổng quan"}
              {view === "my-music" && "Nhạc của tôi"}
              {view === "analytics" && "Phân tích"}
            </h1>
            <span className="dash-header-sub">{greeting}, {session?.displayName || session?.username}</span>
          </div>
          <button type="button" className="dash-btn-primary" onClick={() => onOpenSubmitMusic?.()}>
            <Plus size={15} /> Tạo tác phẩm mới
          </button>
        </header>

        {/* Content */}
        <div className="dash-content">
          <AnimatePresence mode="wait">
            {/* ════════════════ OVERVIEW ════════════════ */}
            {view === "overview" && (
              <motion.div key="overview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                {/* Stats Grid */}
                <div className="dash-stats-grid">
                  <StatCard
                    label="Tổng lượt nghe"
                    value={stats?.totalPlays ?? "—"}
                    icon={Headphones}
                    accent="var(--c-sage-deep)"
                  />
                  <StatCard
                    label="Người nghe tháng"
                    value={stats?.monthlyListeners ?? "—"}
                    icon={Users}
                    accent="var(--c-gold)"
                  />
                  <StatCard
                    label="Người theo dõi"
                    value={stats?.followers ?? "—"}
                    icon={Heart}
                    accent="var(--c-rose)"
                  />
                  <StatCard
                    label="Tác phẩm"
                    value={allReleases.length}
                    icon={Disc3}
                    accent="var(--c-sage)"
                  />
                </div>

                {/* Sparkline — plays last 14 days */}
                {stats?.dailyPlays && (
                  <div className="dash-section">
                    <h2 className="dash-section-title">Lượt nghe 14 ngày gần đây</h2>
                    <div className="dash-sparkline-wrap">
                      <MiniSparkline data={stats.dailyPlays} />
                      <div className="dash-sparkline-labels">
                        <span>{stats.dailyPlays[0]?.date?.slice(5)}</span>
                        <span>{stats.dailyPlays[stats.dailyPlays.length - 1]?.date?.slice(5)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Top Tracks */}
                {stats?.topTracks && stats.topTracks.length > 0 && (
                  <div className="dash-section">
                    <h2 className="dash-section-title">Bài hát nổi bật</h2>
                    <div className="dash-top-tracks">
                      {stats.topTracks.slice(0, 5).map((t, i) => (
                        <div key={t.id} className="dash-top-track-row">
                          <span className="dash-top-rank">#{i + 1}</span>
                          <div
                            className="dash-top-art"
                            style={
                              t.coverUrl
                                ? { backgroundImage: `url('${t.coverUrl}')` }
                                : { background: gradientFor(hashHue(t.title)) }
                            }
                          />
                          <div className="dash-top-info">
                            <div className="dash-top-title">{t.title}</div>
                            <div className="dash-top-plays">{(t.playCount || 0).toLocaleString()} lượt nghe</div>
                          </div>
                          <span className="dash-top-duration">{formatTime(t.duration || 0)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Activity */}
                {stats?.recentPlays && stats.recentPlays.length > 0 && (
                  <div className="dash-section">
                    <h2 className="dash-section-title">Hoạt động gần đây</h2>
                    <div className="dash-activity-list">
                      {stats.recentPlays.slice(0, 8).map((play, i) => (
                        <ActivityRow key={i} play={play} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Quick Actions */}
                <div className="dash-section">
                  <h2 className="dash-section-title">Thao tác nhanh</h2>
                  <div className="dash-quick-actions">
                    <button type="button" className="dash-quick-card" onClick={() => onOpenSubmitMusic?.()}>
                      <Upload size={20} />
                      <span>Tạo tác phẩm mới</span>
                    </button>
                    <button type="button" className="dash-quick-card" onClick={() => setView("my-music")}>
                      <Music size={20} />
                      <span>Quản lý nhạc</span>
                    </button>
                    <button type="button" className="dash-quick-card" onClick={() => setView("analytics")}>
                      <BarChart3 size={20} />
                      <span>Xem phân tích</span>
                    </button>
                    <button type="button" className="dash-quick-card" onClick={onOpenArtist}>
                      <ExternalLink size={20} />
                      <span>Hồ sơ công khai</span>
                    </button>
                  </div>
                </div>

                {/* Empty state */}
                {allReleases.length === 0 && !loading && (
                  <div className="dash-empty">
                    <Music size={32} style={{ opacity: 0.15, color: "var(--c-sage)" }} />
                    <p>Chưa có phát hành nào. Tạo phát hành đầu tiên của bạn!</p>
                    <button type="button" className="dash-btn-primary" onClick={() => onOpenSubmitMusic?.()}>
                      <Plus size={14} /> Tạo tác phẩm mới
                    </button>
                  </div>
                )}
              </motion.div>
            )}

            {/* ════════════════ MY MUSIC ════════════════ */}
            {view === "my-music" && (
              <motion.div key="mymusic" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                {/* Toolbar */}
                <div className="dash-toolbar">
                  <div className="dash-search">
                    <Search size={14} />
                    <input
                      type="text"
                      placeholder="Tìm phát hành..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <div className="dash-filters">
                    {["all", "draft", "pending_review", "published", "rejected"].map((f) => (
                      <button
                        key={f}
                        type="button"
                        className={"dash-filter-btn" + (filter === f ? " active" : "")}
                        onClick={() => setFilter(f)}
                      >
                        {f === "all" ? "Tất cả" : STATUS_LABELS[f]?.label || f}
                        {subCounts[f] !== undefined && (
                          <span className="dash-filter-count">{subCounts[f]}</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Release list */}
                <div className="dash-release-list">
                  {filtered.map((r) => (
                    <ReleaseRow key={r.id} release={r} onAction={handleAction} />
                  ))}
                  {filtered.length === 0 && !loading && (
                    <div className="dash-empty">
                      <Music size={28} style={{ opacity: 0.15, color: "var(--c-sage)" }} />
                      <p>Không tìm thấy phát hành phù hợp.</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* ════════════════ ANALYTICS ════════════════ */}
            {view === "analytics" && (
              <motion.div key="analytics" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                {/* Summary cards */}
                <div className="dash-stats-grid">
                  <StatCard label="Tổng lượt nghe" value={stats?.totalPlays ?? "—"} icon={Headphones} accent="var(--c-sage-deep)" />
                  <StatCard label="Người nghe tháng" value={stats?.monthlyListeners ?? "—"} icon={Users} accent="var(--c-gold)" />
                  <StatCard label="Người theo dõi" value={stats?.followers ?? "—"} icon={Heart} accent="var(--c-rose)" />
                  <StatCard
                    label="Đã phát hành"
                    value={subCounts.published || 0}
                    icon={CheckCircle}
                    accent="var(--success)"
                  />
                </div>

                {/* Daily plays chart */}
                {stats?.dailyPlays && (
                  <div className="dash-section">
                    <h2 className="dash-section-title">Lượt nghe theo ngày (14 ngày)</h2>
                    <div className="dash-chart-wrap">
                      <div className="dash-chart-bars">
                        {stats.dailyPlays.map((d, i) => {
                          const max = Math.max(...stats.dailyPlays.map((x) => x.plays), 1);
                          return (
                            <div key={i} className="dash-chart-col">
                              <div className="dash-chart-value">{d.plays || ""}</div>
                              <div
                                className="dash-chart-bar"
                                style={{ height: `${(d.plays / max) * 100}%` }}
                              />
                              <div className="dash-chart-date">{d.date.slice(5)}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Track play history */}
                {stats?.trackPlayHistory && stats.trackPlayHistory.length > 0 && (
                  <div className="dash-section">
                    <h2 className="dash-section-title">Lượt nghe theo bài hát (30 ngày)</h2>
                    <div className="dash-release-list">
                      {stats.trackPlayHistory.map((tp, i) => {
                        const track = (stats.topTracks || []).find((t) => t.id === tp.track_id);
                        return (
                          <div key={tp.track_id} className="dash-release-row">
                            <span className="dash-top-rank">#{i + 1}</span>
                            <div
                              className="dash-release-art"
                              style={
                                track?.coverUrl
                                  ? { backgroundImage: `url('${track.coverUrl}')` }
                                  : { background: gradientFor(hashHue(track?.title || "")) }
                              }
                            />
                            <div className="dash-release-info">
                              <div className="dash-release-title">{track?.title || "—"}</div>
                              <div className="dash-release-meta">
                                <span>{tp.plays} lượt nghe trong 30 ngày</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Submission breakdown */}
                <div className="dash-section">
                  <h2 className="dash-section-title">Trạng thái tác phẩm</h2>
                  <div className="dash-status-breakdown">
                    {[
                      { key: "draft", label: "Bản nháp", color: "var(--text-muted)" },
                      { key: "pending_review", label: "Chờ review", color: "var(--c-gold)" },
                      { key: "approved", label: "Đã duyệt", color: "var(--success)" },
                      { key: "published", label: "Đã phát hành", color: "var(--c-sage-deep)" },
                      { key: "rejected", label: "Bị từ chối", color: "var(--danger)" },
                    ].map((s) => (
                      <div key={s.key} className="dash-status-item">
                        <div className="dash-status-dot" style={{ background: s.color }} />
                        <span className="dash-status-label">{s.label}</span>
                        <span className="dash-status-count">{subCounts[s.key] || 0}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {(!stats || (!stats.totalPlays && !stats.monthlyListeners)) && (
                  <div className="dash-empty">
                    <BarChart3 size={28} style={{ opacity: 0.15, color: "var(--c-sage)" }} />
                    <p>Chưa đủ dữ liệu phân tích. Hãy phát hành thêm tác phẩm!</p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
