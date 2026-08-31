import { useState, useMemo, useRef } from "react";
import { ShieldCheck, LogOut, Mic2, ChevronRight, Heart, Music, Users, Headphones, Clock, TrendingUp, Disc3, Star, ListMusic, Eye, ExternalLink, Sparkles, Settings2, HelpCircle, Pencil, X, Camera, Upload } from "lucide-react";
import { api } from "../api";
import { motion } from "framer-motion";
import TrackCard from "../components/TrackCard";
import ArtistBadge from "../components/ArtistBadge";
import { DividerFlourish, Flower, Butterfly, Vine } from "../assets/Botanical";
import { gradientFor, hashHue, initials, formatTime } from "../lib/format";

function FadeIn({ children, delay = 0 }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.25, 0.1, 0.25, 1] }}>
      {children}
    </motion.div>
  );
}

export default function ProfilePage({
  session, myTracksState, current, isPlaying,
  onPlay, onLike, onSave, onShare, onComment, onLyrics, onLogout,
  myArtist, onBecomeArtist, onOpenArtistProfile, onOpenArtistDashboard, onAddToPlaylist,
  onOpenSettings, onOpenSupport,
}) {
  const [activeTab, setActiveTab] = useState("overview");
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [editName, setEditName] = useState(session.displayName || "");
  const [editBio, setEditBio] = useState("");
  const [editAvatarFile, setEditAvatarFile] = useState(null);
  const [editAvatarPreview, setEditAvatarPreview] = useState(null);
  const [editBgFile, setEditBgFile] = useState(null);
  const [editBgPreview, setEditBgPreview] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const avatarInputRef = useRef(null);
  const bgInputRef = useRef(null);

  function handleAvatarSelect(e) {
    const file = e.target.files?.[0];
    if (file) {
      setEditAvatarFile(file);
      setEditAvatarPreview(URL.createObjectURL(file));
    }
  }
  function handleBgSelect(e) {
    const file = e.target.files?.[0];
    if (file) {
      setEditBgFile(file);
      setEditBgPreview(URL.createObjectURL(file));
    }
  }
  async function saveProfile() {
    setEditSaving(true);
    try {
      const payload = {};
      if (editName.trim()) payload.displayName = editName.trim();
      payload.bio = editBio;
      const result = await api.updateProfile(payload);
      if (result && result.user) {
        // Update the session object passed from parent
        if (session) {
          session.displayName = result.user.displayName;
        }
      }
      setEditProfileOpen(false);
      window.location.reload(); // Refresh to reflect changes
    } catch (err) {
      console.error('Profile save error:', err);
    }
    setEditSaving(false);
  }
  const tabs = [
    { id: "overview", label: "Tổng quan", icon: Eye },
    { id: "songs", label: "Bài hát", icon: Music },
    { id: "liked", label: "Đã thích", icon: Heart },
    { id: "playlists", label: "Playlist", icon: ListMusic },
    { id: "recent", label: "Gần đây", icon: Clock },
  ];

  const stats = {
    songs: myTracksState.length,
    followers: myArtist ? myArtist.followers || 0 : 0,
    following: myArtist ? myArtist.following || 0 : 0,
    monthlyListeners: myArtist ? myArtist.monthlyListeners || 0 : 0,
    totalPlays: myTracksState.reduce((sum, t) => sum + (t.playCount || 0), 0),
    totalLikes: myTracksState.reduce((sum, t) => sum + t.likedBy.length, 0),
  };

  const topGenre = useMemo(() => {
    const genreCount = {};
    myTracksState.forEach((t) => (t.genres || []).forEach((g) => { genreCount[g] = (genreCount[g] || 0) + 1; }));
    const sorted = Object.entries(genreCount).sort((a, b) => b[1] - a[1]);
    return sorted.length > 0 ? sorted[0][0] : null;
  }, [myTracksState]);

  const recentTracks = useMemo(() => {
    return [...myTracksState].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 10);
  }, [myTracksState]);

  const tracks = myTracksState; // alias for onClick handlers

  return (
    <section className="pf-page">
      {/* ─── Hero Cover ─── */}
      <div className="pf-cover">
        <div className="pf-cover-bg" />
        <div className="pf-cover-decor pf-cover-decor-tl"><Vine size={90} direction="right" /></div>
        <div className="pf-cover-decor pf-cover-decor-br"><Flower size={24} style={{ opacity: 0.15, color: "var(--c-rose)" }} /></div>
      </div>

      {/* ─── Profile Info ─── */}
      <div className="pf-info">
        <div className="pf-avatar-section">
          <div className="pf-avatar">
            <div className="pf-avatar-img" style={{ background: gradientFor(hashHue(session.displayName)) }}>
              {initials(session.displayName)}
            </div>
            {myArtist && <div className="pf-avatar-badge"><ArtistBadge badge={myArtist.badge} size={18} /></div>}
          </div>
          <div className="pf-name-block">
            <h1 className="pf-name">{session.displayName}</h1>
            <p className="pf-handle">@{session.username}{session.isAdmin && <span className="pf-admin-tag">Admin</span>}</p>
            {topGenre && (
              <div className="pf-genre">
                <Music size={11} />
                <span>{topGenre}</span>
              </div>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="pf-actions">
          {myArtist ? (
            <>
              <button type="button" className="btn-primary" onClick={onOpenArtistDashboard}>
                <Mic2 size={15} /> Dashboard
              </button>
              <button type="button" className="btn-secondary" onClick={onOpenArtistProfile}>
                <ExternalLink size={15} /> Hồ sơ công khai
              </button>
            </>
          ) : (              <button type="button" className="btn-primary" onClick={onBecomeArtist}>
              <Sparkles size={15} /> Trở thành nghệ sĩ
            </button>
          )}
        </div>
      </div>

      {/* ─── Edit Profile Modal ─── */}
      {editProfileOpen && (
          <div className="ep-overlay" onClick={() => setEditProfileOpen(false)}>
            <div className="ep-modal" onClick={(e) => e.stopPropagation()}>
              <div className="ep-header">
                <h2>Chỉnh sửa hồ sơ</h2>
                <button type="button" className="icon-btn" onClick={() => setEditProfileOpen(false)}>
                  <X size={18} />
                </button>
              </div>

              <div className="ep-body">
                {/* Background cover */}
                <div className="ep-bg-section">
                  <div className="ep-bg-preview"
                    style={editBgPreview ? { backgroundImage: `url(${editBgPreview})` } : { background: 'linear-gradient(135deg, rgba(154,166,138,0.12) 0%, rgba(239,227,205,0.18) 50%, rgba(212,180,131,0.1) 100%)' }}>
                    <button type="button" className="ep-bg-btn" onClick={() => bgInputRef.current?.click()}>
                      <Camera size={14} /> Đổi ảnh bìa
                    </button>
                    <input ref={bgInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleBgSelect} />
                  </div>
                </div>

                {/* Avatar */}
                <div className="ep-avatar-section">
                  <div className="ep-avatar-preview"
                    style={editAvatarPreview ? { backgroundImage: `url(${editAvatarPreview})` } : { background: gradientFor(hashHue(editName)) }}>
                    {!editAvatarPreview && <span className="ep-avatar-initials">{initials(editName)}</span>}
                    <button type="button" className="ep-avatar-btn" onClick={() => avatarInputRef.current?.click()}>
                      <Upload size={14} />
                    </button>
                    <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarSelect} />
                  </div>
                </div>

                {/* Name */}
                <div className="ep-field">
                  <label>Tên hiển thị</label>
                  <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={50} placeholder="Tên của bạn" />
                </div>

                {/* Bio */}
                <div className="ep-field">
                  <label>Mô tả</label>
                  <textarea value={editBio} onChange={(e) => setEditBio(e.target.value)} maxLength={300} rows={3} placeholder="Giới thiệu ngắn về bạn..." />
                </div>

                <div className="ep-actions">
                  <button type="button" className="btn-secondary" onClick={() => setEditProfileOpen(false)}>Hủy</button>
                  <button type="button" className="btn-primary" onClick={saveProfile} disabled={editSaving}>
                    {editSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
                  </button>
                </div>
              </div>
            </div>
          </div>
      )}

      {/* ─── Stats ─── */}
      <FadeIn delay={0.05}>
        <div className="pf-stats">
          <div className="pf-stat-card">
            <div className="pf-stat-val">{stats.songs}</div>
            <div className="pf-stat-lbl">Bài hát</div>
          </div>
          <div className="pf-stat-card">
            <div className="pf-stat-val">{stats.totalPlays > 1000 ? Math.round(stats.totalPlays / 1000) + "K" : stats.totalPlays}</div>
            <div className="pf-stat-lbl">Lượt nghe</div>
          </div>
          <div className="pf-stat-card">
            <div className="pf-stat-val">{stats.totalLikes}</div>
            <div className="pf-stat-lbl">Lượt thích</div>
          </div>
          <div className="pf-stat-card">
            <div className="pf-stat-val">{stats.followers}</div>
            <div className="pf-stat-lbl">Follower</div>
          </div>
        </div>
      </FadeIn>

      {/* ─── Quick Stats (if artist) ─── */}
      {myArtist && stats.monthlyListeners > 0 && (
        <FadeIn delay={0.1}>
          <div className="pf-monthly">
            <Headphones size={16} style={{ color: "var(--c-sage)" }} />
            <span className="pf-monthly-val">{stats.monthlyListeners > 1000 ? Math.round(stats.monthlyListeners / 1000) + "K" : stats.monthlyListeners}</span>
            <span className="pf-monthly-lbl"> người nghe tháng này</span>
          </div>
        </FadeIn>
      )}

      {/* ─── Tabs ─── */}
      <FadeIn delay={0.15}>
        <div className="pf-tabs">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.id} type="button" className={"pf-tab" + (activeTab === t.id ? " active" : "")} onClick={() => setActiveTab(t.id)}>
                <Icon size={14} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </FadeIn>

      {/* ─── Content ─── */}
      <div className="pf-content">
        {/* Overview */}
        {activeTab === "overview" && (
          <div>
            {recentTracks.length > 0 ? (
              <div className="pf-list">
                <div className="pf-list-header">
                  <TrendingUp size={14} />
                  <span>BÀI HÁT CỦA BẠN</span>
                </div>
                {recentTracks.slice(0, 6).map((t, i) => {
                  const artist = (t.credits && t.credits[0] && t.credits[0].artistName) || t.composer || t.uploaderDisplayName;
                  const isCur = !!current && current.trackId === t.id;
                  return (
                    <div key={t.id} className={"pf-row" + (isCur ? " pf-row-active" : "")}
                      onClick={() => { const idx = tracks.findIndex((tr) => tr.id === t.id); if (idx >= 0) onPlay(tracks, idx); }}>
                      <span className="pf-rank">{isCur && isPlaying ? <Disc3 size={13} className="spin" /> : String(i + 1).padStart(2, "0")}</span>
                      <div className="pf-row-art" style={t.coverUrl ? { backgroundImage: `url('${t.coverUrl}')` } : { background: gradientFor(hashHue(t.title)) }} />
                      <div className="pf-row-info">
                        <div className="pf-row-title">{t.title}</div>
                        <div className="pf-row-artist">{artist}</div>
                      </div>
                      <span className="pf-row-dur">{formatTime(t.duration || 0)}</span>
                      <button type="button" className="pf-row-like" onClick={(e) => { e.stopPropagation(); onLike(t.id); }}>
                        <Heart size={13} fill={t.likedBy.includes(session.username) ? "currentColor" : "none"} className={t.likedBy.includes(session.username) ? "active active-wine" : ""} />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="pf-empty">
                <Flower size={36} style={{ opacity: 0.18, color: "var(--c-sage)" }} />
                <h3>Thư viện đang chờ</h3>
                <p>Nghe nhạc, thích bài hát, theo dõi nghệ sĩ để xây dựng thư viện của bạn.</p>
                <button type="button" className="btn-secondary" style={{ marginTop: 8 }}>Khám phá âm nhạc</button>
              </div>
            )}
          </div>
        )}

        {/* Songs */}
        {activeTab === "songs" && (
          <div>
            {myTracksState.length > 0 ? (
              <div className="pf-list">
                <div className="pf-list-header"><Music size={14} /><span>TẤT CẢ BÀI HÁT</span></div>
                {myTracksState.map((t, i) => {
                  const artist = (t.credits && t.credits[0] && t.credits[0].artistName) || t.composer || t.uploaderDisplayName;
                  const isCur = !!current && current.trackId === t.id;
                  return (
                    <div key={t.id} className={"pf-row" + (isCur ? " pf-row-active" : "")}
                      onClick={() => { const idx = tracks.findIndex((tr) => tr.id === t.id); if (idx >= 0) onPlay(tracks, idx); }}>
                      <span className="pf-rank">{isCur && isPlaying ? <Disc3 size={13} className="spin" /> : String(i + 1).padStart(2, "0")}</span>
                      <div className="pf-row-art" style={t.coverUrl ? { backgroundImage: `url('${t.coverUrl}')` } : { background: gradientFor(hashHue(t.title)) }} />
                      <div className="pf-row-info">
                        <div className="pf-row-title">{t.title}</div>
                        <div className="pf-row-artist">{artist}</div>
                      </div>
                      <span className="pf-row-plays">{(t.playCount || 0)} plays</span>
                      <span className="pf-row-dur">{formatTime(t.duration || 0)}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="pf-empty"><Music size={36} style={{ opacity: 0.18, color: "var(--c-sage)" }} /><h3>Chưa có bài hát</h3><p>Bài phát hành sẽ xuất hiện tại đây.</p></div>
            )}
          </div>
        )}

        {/* Liked */}
        {activeTab === "liked" && (
          <div className="pf-empty"><Heart size={36} style={{ opacity: 0.18, color: "var(--c-rose)" }} /><h3>Chưa thích bài nào</h3><p>Nhấn ❤ trên bất kỳ bài hát nào.</p></div>
        )}

        {/* Playlists */}
        {activeTab === "playlists" && (
          <div className="pf-empty"><ListMusic size={36} style={{ opacity: 0.18, color: "var(--c-sage)" }} /><h3>Chưa có playlist</h3><p>Tạo playlist đầu tiên.</p></div>
        )}

        {/* Recent */}
        {activeTab === "recent" && (
          <div>
            {recentTracks.length > 0 ? (
              <div className="pf-list">
                <div className="pf-list-header"><Clock size={14} /><span>GẦN ĐÂY</span></div>
                {recentTracks.map((t, i) => {
                  const artist = (t.credits && t.credits[0] && t.credits[0].artistName) || t.composer || t.uploaderDisplayName;
                  const isCur = !!current && current.trackId === t.id;
                  return (
                    <div key={t.id} className={"pf-row" + (isCur ? " pf-row-active" : "")}
                      onClick={() => { const idx = tracks.findIndex((tr) => tr.id === t.id); if (idx >= 0) onPlay(tracks, idx); }}>
                      <span className="pf-rank">{isCur && isPlaying ? <Disc3 size={13} className="spin" /> : String(i + 1).padStart(2, "0")}</span>
                      <div className="pf-row-art" style={t.coverUrl ? { backgroundImage: `url('${t.coverUrl}')` } : { background: gradientFor(hashHue(t.title)) }} />
                      <div className="pf-row-info"><div className="pf-row-title">{t.title}</div><div className="pf-row-artist">{artist}</div></div>
                      <span className="pf-row-dur">{formatTime(t.duration || 0)}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="pf-empty"><Clock size={36} style={{ opacity: 0.18, color: "var(--c-sage)" }} /><h3>Chưa có lịch sử</h3><p>Bài nghe sẽ xuất hiện tại đây.</p></div>
            )}
          </div>
        )}
      </div>

      {/* ─── Edit Profile Section ─── */}
      <div className="pf-section-divider" />
      <div className="pf-edit-section">
        <button type="button" className="pf-action-link pf-edit-btn" onClick={() => setEditProfileOpen(true)}>
          <Pencil size={15} /> <span>Chỉnh sửa hồ sơ</span>
        </button>
      </div>

      {/* ─── Admin ─── */}
      {session.isAdmin && (
        <div className="pf-section-divider" />
      )}
      {session.isAdmin && (
        <div className="pf-edit-section">
          <a href="/admin" className="pf-admin-link">
            <ShieldCheck size={16} />
            <span>Admin Dashboard</span>
            <ChevronRight size={14} />
          </a>
        </div>
      )}

      {/* ─── Settings & Support ─── */}
      <div className="pf-section-divider" />
      <div className="pf-edit-section">
        <div className="pf-actions-row">
          <button type="button" className="pf-action-link" onClick={onOpenSettings}>
            <Settings2 size={15} /> <span>Cài đặt</span>
          </button>
          <button type="button" className="pf-action-link" onClick={onOpenSupport}>
            <HelpCircle size={15} /> <span>Hỗ trợ</span>
          </button>
        </div>
      </div>

      {/* ─── Logout ─── */}
      <div className="pf-footer">
        <button type="button" className="pf-logout" onClick={onLogout}>
          <LogOut size={14} /> Đăng xuất
        </button>
      </div>
    </section>
  );
}
