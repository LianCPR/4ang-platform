import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, UserPlus, UserCheck, LayoutDashboard, Play, Clock, ExternalLink, Music, Share2 } from "lucide-react";
import { api } from "../api";
import ArtistBadge from "../components/ArtistBadge";
import EmptyState from "../components/EmptyState";
import { gradientFor, hashHue, initials, formatCount, formatTime } from "../lib/format";
import { Flower, Butterfly, Vine } from "../assets/Botanical";

const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } } };

export default function ArtistProfilePage({ username, session, onBack, onOpenDashboard, onPlay, current, isPlaying, progress, onOpenArtist, onShareArtist, ...railProps }) {
  const [artist, setArtist] = useState(null);
  const [error, setError] = useState("");
  const [followBusy, setFollowBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setArtist(null);
    setError("");
    api.artistProfile(username).then((res) => { if (!cancelled) setArtist(res.artist); }).catch((err) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [username]);

  async function toggleFollow() {
    if (!artist || followBusy) return;
    setFollowBusy(true);
    try {
      const res = artist.isFollowing ? await api.unfollowArtist(username) : await api.followArtist(username);
      setArtist((a) => ({ ...a, isFollowing: res.isFollowing, followers: res.followers }));
    } catch { /* no-op */ }
    setFollowBusy(false);
  }

  return (
    <motion.div className="artist-page ap-redesign" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}>
        {onBack && (
          <button type="button" className="artist-back-btn" onClick={onBack}>
            <ChevronLeft size={18} /> Quay lại
          </button>
        )}

        {error && <EmptyState title="Không tìm thấy nghệ sĩ" subtitle={error} />}

        {artist && (
          <>
            {/* ── Cinematic Cover ── */}
            <div className="ap-cover-wrap">
              <div className="ap-cover" style={artist.coverUrl ? { backgroundImage: `url('${artist.coverUrl}')` } : { background: gradientFor(hashHue(artist.username)) }}>
                <div className="ap-cover-gradient" />
              </div>
              {/* Botanical decoration */}
              <motion.div className="ap-cover-decor ap-cover-decor-bl"
                animate={{ y: [0, -4, 0], rotate: [0, 2, 0] }}
                transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}>
                <Vine size={48} />
              </motion.div>
              <motion.div className="ap-cover-decor ap-cover-decor-tr"
                animate={{ x: [0, 3, 0], opacity: [0.3, 0.5, 0.3] }}
                transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}>
                <Flower size={18} />
              </motion.div>
            </div>

            {/* ── Profile Header ── */}
            <div className="ap-profile">
              <div className="ap-avatar-wrap">
                <div className="ap-avatar" style={artist.avatarUrl ? { backgroundImage: `url('${artist.avatarUrl}')` } : { background: gradientFor(hashHue(artist.artistName)) }}>
                  {!artist.avatarUrl && <span className="ap-avatar-initials">{initials(artist.artistName)}</span>}
                </div>
                <div className="ap-avatar-ring" />
              </div>

              <div className="ap-profile-info">
                <h1 className="ap-name">{artist.artistName}</h1>
                {artist.badge && (
                  <div className="ap-badge-row">
                    <ArtistBadge badge={artist.badge} size={14} />
                    <span className="ap-badge-text">
                      {artist.badge === "verified" ? "Nghệ sĩ được 4ANG xác minh" : "Nghệ sĩ độc lập trên 4ANG"}
                    </span>
                  </div>
                )}
                {artist.bio && <p className="ap-bio">{artist.bio}</p>}
              </div>

              <div className="ap-actions">
                {artist.isOwner ? (
                  <button type="button" className="btn-primary" onClick={onOpenDashboard}>
                    <LayoutDashboard size={15} /> Quản lý
                  </button>
                ) : (
                  <button className={"btn-secondary" + (artist.isFollowing ? " active" : "")} onClick={toggleFollow} disabled={followBusy}>
                    {artist.isFollowing ? <UserCheck size={15} /> : <UserPlus size={15} />} {artist.isFollowing ? "Đang theo dõi" : "Theo dõi"}
                  </button>
                )}
                {onShareArtist && (
                  <button type="button" className="icon-btn" onClick={() => onShareArtist({ id: artist.username, title: artist.artistName, artist: artist.artistName, coverUrl: artist.avatarUrl })} aria-label="Chia sẻ">
                    <Share2 size={17} />
                  </button>
                )}
              </div>
            </div>

            {/* ── Stats ── */}
            <div className="ap-stats">
              <div className="ap-stat-card">
                <div className="ap-stat-value">{formatCount(artist.monthlyListeners)}</div>
                <div className="ap-stat-label">Nghe hàng tháng</div>
              </div>
              <div className="ap-stat-card">
                <div className="ap-stat-value">{formatCount(artist.followers)}</div>
                <div className="ap-stat-label">Người theo dõi</div>
              </div>
              <div className="ap-stat-card">
                <div className="ap-stat-value">{formatCount(artist.totalPlays)}</div>
                <div className="ap-stat-label">Tổng lượt nghe</div>
              </div>
            </div>

            {/* ── Links ── */}
            {artist.links.length > 0 && (
              <div className="ap-links">
                {artist.links.map((l, i) => (
                  <a key={i} href={l.url} target="_blank" rel="noreferrer noopener" className="ap-link-chip">
                    <ExternalLink size={12} /> {l.label}
                  </a>
                ))}
              </div>
            )}

            {/* ── Top Tracks ── */}
            <div className="ap-section">
              <div className="ap-section-header">
                <h2 className="ap-section-title">Phổ biến nhất</h2>
                <Music size={16} style={{ color: "var(--text-faint)" }} />
              </div>
              {artist.topTracks.length === 0 ? (
                <div className="ap-empty-tracks">
                  <Music size={24} style={{ opacity: 0.2 }} />
                  <p>Chưa có bài hát nào được phát hành.</p>
                </div>
              ) : (
                <div className="ap-track-list">
                  {artist.topTracks.map((t, i) => {
                    const isCurrent = current && current.trackId === t.id;
                    return (
                      <div key={t.id} className={"ap-track-row" + (isCurrent ? " playing" : "")} onClick={() => onPlay && onPlay(artist.topTracks, i)}>
                        <span className="ap-track-num">
                          {isCurrent && isPlaying ? (
                            <span className="ap-track-eq">
                              <span /><span /><span />
                            </span>
                          ) : (
                            <span className="ap-track-num-text">{String(i + 1).padStart(2, "0")}</span>
                          )}
                        </span>
                        <div className="ap-track-art" style={t.coverUrl ? { backgroundImage: `url('${t.coverUrl}')` } : { background: gradientFor(hashHue(t.title)) }}>
                          <div className="ap-track-play-overlay">
                            <Play size={14} fill="white" />
                          </div>
                        </div>
                        <div className="ap-track-info">
                          <div className="ap-track-title">{t.title}</div>
                          <div className="ap-track-artist">
                            {t.credits && t.credits[0] ? t.credits[0].artistName : t.composer || t.uploaderDisplayName}
                          </div>
                        </div>
                        <span className="ap-track-duration">
                          <Clock size={11} /> {formatTime(t.duration || 0)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </motion.div>
  );
}
