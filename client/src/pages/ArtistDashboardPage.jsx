import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Disc3, TrendingUp, Users, Music, Eye, Plus, Search, Filter, Clock,
  CheckCircle, XCircle, AlertCircle, MoreHorizontal, Play, Edit3, Trash2, Send,
  BarChart3, FileText, Heart, Bookmark, Activity, Calendar
} from "lucide-react";
import { api } from "../api";
import { gradientFor, hashHue, formatTime, timeAgo } from "../lib/format";

const STATUS_LABELS = {
  draft: { label: "Bản nháp", icon: FileText, color: "var(--text-muted)" },
  pending_review: { label: "Chờ review", icon: Clock, color: "var(--c-gold)" },
  under_review: { label: "Đang review", icon: AlertCircle, color: "var(--c-sage)" },
  approved: { label: "Đã duyệt", icon: CheckCircle, color: "#4caf50" },
  published: { label: "Đã phát hành", icon: CheckCircle, color: "var(--c-sage-deep)" },
  rejected: { label: "Bị từ chối", icon: XCircle, color: "#e74c3c" },
};

/* ─── Stat card ──────────────────────────── */
function StatCard({ label, value, icon: Icon, accent }) {
  return (
    <div className="ad-stat-card">
      <div className="ad-stat-icon" style={accent ? { color: accent } : {}}>
        <Icon size={18} />
      </div>
      <div className="ad-stat-value">{value}</div>
      <div className="ad-stat-label">{label}</div>
    </div>
  );
}

/* ─── Mini sparkline (CSS-only bars) ────── */
function MiniSparkline({ data }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.plays), 1);
  return (
    <div className="ad-sparkline">
      {data.map((d, i) => (
        <div
          key={i}
          className="ad-sparkline-bar"
          style={{ height: `${(d.plays / max) * 100}%` }}
          title={`${d.date}: ${d.plays} lượt`}
        />
      ))}
    </div>
  );
}

/* ─── Activity row ──────────────────────── */
function ActivityRow({ play }) {
  return (
    <div className="ad-activity-row">
      <div className="ad-activity-icon">
        <Play size={12} />
      </div>
      <div className="ad-activity-info">
        <span className="ad-activity-user">{play.username || "Ẩn danh"}</span>
        {" đã nghe "}
        <span className="ad-activity-track">{play.trackTitle}</span>
      </div>
      <span className="ad-activity-time">{timeAgo(play.createdAt)}</span>
    </div>
  );
}

/* ─── Release row ───────────────────────── */
function ReleaseRow({ release, onAction }) {
  const status = STATUS_LABELS[release.status] || STATUS_LABELS.draft;
  const StatusIcon = status.icon;
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="ad-release-row">
      <div
        className="ad-release-art"
        style={
          release.coverUrl
            ? { backgroundImage: `url('${release.coverUrl}')` }
            : { background: gradientFor(hashHue(release.title)) }
        }
      />
      <div className="ad-release-info">
        <div className="ad-release-title">{release.title}</div>
        <div className="ad-release-meta">
          <span className="ad-release-type">{release.type || "single"}</span>
          <span>·</span>
          <span>{release.trackCount || 0} track{(release.trackCount || 0) !== 1 ? "s" : ""}</span>
          <span>·</span>
          <span>{new Date(release.createdAt).toLocaleDateString("vi-VN")}</span>
        </div>
      </div>
      <div className="ad-release-status" style={{ color: status.color }}>
        <StatusIcon size={13} /> {status.label}
      </div>
      <div className="ad-release-actions">
        <button type="button" className="icon-btn" onClick={() => setMenuOpen(!menuOpen)}>
          <MoreHorizontal size={16} />
        </button>
        {menuOpen && (
          <div className="ad-release-menu">
            {release.status === "draft" && (
              <button type="button" onClick={() => { onAction("submit", release.id); setMenuOpen(false); }}>
                <Send size={14} /> Gửi review
              </button>
            )}
            {release.status === "draft" && (
              <button type="button" className="ad-menu-danger" onClick={() => { onAction("delete", release.id); setMenuOpen(false); }}>
                <Trash2 size={14} /> Xoá
              </button>
            )}
            {release.status === "rejected" && release.rejectionReason && (
              <div className="ad-release-reject-reason">
                <XCircle size={12} /> {release.rejectionReason}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════ */
export default function ArtistDashboardPage({ session, showToast, onClose, onOpenSubmitMusic }) {
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
      if (statsRes) {
        setStats(statsRes);
      }
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

  /* Combine submissions and published tracks into releases */
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
    /* Sort newest first */
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
    <div className="ad-page">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        {/* ── Header ── */}
        <div className="ad-header">
          <button type="button" className="link-btn" onClick={onClose}>
            <ArrowLeft size={16} /> Quay lại
          </button>
          <div className="ad-header-title">
            <h1 className="ad-title">Artist Dashboard</h1>
            <span className="ad-header-greeting">{greeting}</span>
          </div>
          <button type="button" className="btn-primary btn-sm" onClick={() => onOpenSubmitMusic?.()}>
            <Plus size={15} /> Tác phẩm mới
          </button>
        </div>

        {/* ── Nav Tabs ── */}
        <div className="ad-nav">
          {[
            { id: "overview", label: "Tổng quan", icon: BarChart3 },
            { id: "my-music", label: "Nhạc của tôi", icon: Music },
            { id: "analytics", label: "Phân tích", icon: Activity },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={"ad-nav-item" + (view === tab.id ? " active" : "")}
              onClick={() => setView(tab.id)}
            >
              <tab.icon size={15} /> {tab.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* ════════════════ OVERVIEW ════════════════ */}
          {view === "overview" && (
            <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {/* Stats Grid */}
              <div className="ad-stats-grid">
                <StatCard
                  label="Tổng lượt nghe"
                  value={stats?.totalPlays ?? "—"}
                  icon={Play}
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
                <div className="ad-section">
                  <h2 className="ad-section-title">Lượt nghe 14 ngày gần đây</h2>
                  <div className="ad-sparkline-wrap">
                    <MiniSparkline data={stats.dailyPlays} />
                    <div className="ad-sparkline-labels">
                      <span>{stats.dailyPlays[0]?.date?.slice(5)}</span>
                      <span>{stats.dailyPlays[stats.dailyPlays.length - 1]?.date?.slice(5)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Top Tracks */}
              {stats?.topTracks && stats.topTracks.length > 0 && (
                <div className="ad-section">
                  <h2 className="ad-section-title">Bài hát nổi bật</h2>
                  <div className="ad-top-tracks">
                    {stats.topTracks.slice(0, 5).map((t, i) => (
                      <div key={t.id} className="ad-top-track-row">
                        <span className="ad-top-rank">#{i + 1}</span>
                        <div
                          className="ad-top-art"
                          style={
                            t.coverUrl
                              ? { backgroundImage: `url('${t.coverUrl}')` }
                              : { background: gradientFor(hashHue(t.title)) }
                          }
                        />
                        <div className="ad-top-info">
                          <div className="ad-top-title">{t.title}</div>
                          <div className="ad-top-plays">{(t.playCount || 0).toLocaleString()} lượt nghe</div>
                        </div>
                        <span className="ad-top-duration">{formatTime(t.duration || 0)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Activity */}
              {stats?.recentPlays && stats.recentPlays.length > 0 && (
                <div className="ad-section">
                  <h2 className="ad-section-title">Hoạt động gần đây</h2>
                  <div className="ad-activity-list">
                    {stats.recentPlays.slice(0, 8).map((play, i) => (
                      <ActivityRow key={i} play={play} />
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {allReleases.length === 0 && !loading && (
                <div className="ad-empty">
                  <Music size={28} style={{ opacity: 0.15, color: "var(--c-sage)" }} />
                  <p>Chưa có phát hành nào. Tạo phát hành đầu tiên của bạn!</p>
                  <button type="button" className="btn-primary btn-sm" onClick={() => onOpenSubmitMusic?.()}>
                    <Plus size={14} /> Tạo tác phẩm mới
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {/* ════════════════ MY MUSIC ════════════════ */}
          {view === "my-music" && (
            <motion.div key="mymusic" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {/* Toolbar */}
              <div className="ad-toolbar">
                <div className="ad-search">
                  <Search size={14} />
                  <input
                    type="text"
                    placeholder="Tìm phát hành..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="ad-filters">
                  {["all", "draft", "pending_review", "published", "rejected"].map((f) => (
                    <button
                      key={f}
                      type="button"
                      className={"ad-filter-btn" + (filter === f ? " active" : "")}
                      onClick={() => setFilter(f)}
                    >
                      {f === "all" ? "Tất cả" : STATUS_LABELS[f]?.label || f}
                      {subCounts[f] !== undefined && (
                        <span className="ad-filter-count">{subCounts[f]}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Release list */}
              <div className="ad-release-list">
                {filtered.map((r) => (
                  <ReleaseRow key={r.id} release={r} onAction={handleAction} />
                ))}
                {filtered.length === 0 && !loading && (
                  <div className="ad-empty">
                    <Music size={28} style={{ opacity: 0.15, color: "var(--c-sage)" }} />
                    <p>Không tìm thấy phát hành phù hợp.</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ════════════════ ANALYTICS ════════════════ */}
          {view === "analytics" && (
            <motion.div key="analytics" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {/* Summary cards */}
              <div className="ad-stats-grid">
                <StatCard label="Tổng lượt nghe" value={stats?.totalPlays ?? "—"} icon={Play} accent="var(--c-sage-deep)" />
                <StatCard label="Người nghe tháng" value={stats?.monthlyListeners ?? "—"} icon={Users} accent="var(--c-gold)" />
                <StatCard label="Người theo dõi" value={stats?.followers ?? "—"} icon={Heart} accent="var(--c-rose)" />
                <StatCard
                  label="Đã phát hành"
                  value={subCounts.published || 0}
                  icon={CheckCircle}
                  accent="#4caf50"
                />
              </div>

              {/* Daily plays chart */}
              {stats?.dailyPlays && (
                <div className="ad-section">
                  <h2 className="ad-section-title">Lượt nghe theo ngày (14 ngày)</h2>
                  <div className="ad-chart-wrap">
                    <div className="ad-chart-bars">
                      {stats.dailyPlays.map((d, i) => {
                        const max = Math.max(...stats.dailyPlays.map((x) => x.plays), 1);
                        return (
                          <div key={i} className="ad-chart-col">
                            <div className="ad-chart-value">{d.plays || ""}</div>
                            <div
                              className="ad-chart-bar"
                              style={{ height: `${(d.plays / max) * 100}%` }}
                            />
                            <div className="ad-chart-date">{d.date.slice(5)}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Track play history */}
              {stats?.trackPlayHistory && stats.trackPlayHistory.length > 0 && (
                <div className="ad-section">
                  <h2 className="ad-section-title">Lượt nghe theo bài hát (30 ngày)</h2>
                  <div className="ad-release-list">
                    {stats.trackPlayHistory.map((tp, i) => {
                      const track = (stats.topTracks || []).find((t) => t.id === tp.track_id);
                      return (
                        <div key={tp.track_id} className="ad-release-row">
                          <span className="ad-top-rank">#{i + 1}</span>
                          <div
                            className="ad-release-art"
                            style={
                              track?.coverUrl
                                ? { backgroundImage: `url('${track.coverUrl}')` }
                                : { background: gradientFor(hashHue(track?.title || "")) }
                            }
                          />
                          <div className="ad-release-info">
                            <div className="ad-release-title">{track?.title || "—"}</div>
                            <div className="ad-release-meta">
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
              <div className="ad-section">
                <h2 className="ad-section-title">Trạng thái tác phẩm</h2>
                <div className="ad-status-breakdown">
                  {[
                    { key: "draft", label: "Bản nháp", color: "var(--text-muted)" },
                    { key: "pending_review", label: "Chờ review", color: "var(--c-gold)" },
                    { key: "approved", label: "Đã duyệt", color: "#4caf50" },
                    { key: "published", label: "Đã phát hành", color: "var(--c-sage-deep)" },
                    { key: "rejected", label: "Bị từ chối", color: "#e74c3c" },
                  ].map((s) => (
                    <div key={s.key} className="ad-status-item">
                      <div className="ad-status-dot" style={{ background: s.color }} />
                      <span className="ad-status-label">{s.label}</span>
                      <span className="ad-status-count">{subCounts[s.key] || 0}</span>
                    </div>
                  ))}
                </div>
              </div>

              {(!stats || (!stats.totalPlays && !stats.monthlyListeners)) && (
                <div className="ad-empty">
                  <BarChart3 size={28} style={{ opacity: 0.15, color: "var(--c-sage)" }} />
                  <p>Chưa đủ dữ liệu phân tích. Hãy phát hành thêm tác phẩm!</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
