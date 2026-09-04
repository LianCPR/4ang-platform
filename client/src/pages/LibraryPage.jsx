import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart, Bookmark, Clock, Users, ListMusic, Music, Search, Play, Pause,
  ChevronRight, Disc3, Headphones, X
} from "lucide-react";
import { api } from "../api";
import TrackCard from "../components/TrackCard";
import ErrorState from "../components/ErrorState";
import { gradientFor, hashHue, formatTime } from "../lib/format";

/* ─── Tab config ─────────────────────────── */
const TABS = [
  { id: "overview", label: "Tổng quan", icon: Headphones },
  { id: "liked", label: "Đã thích", icon: Heart },
  { id: "playlists", label: "Playlist", icon: ListMusic },
  { id: "artists", label: "Nghệ sĩ", icon: Users },
  { id: "recent", label: "Gần đây", icon: Clock },
];

/* ─── Continue Listening Card ────────────── */
function ContinueCard({ item, onPlay, isCurrent, isPlaying }) {
  return (
    <button type="button" className="lib-cont-card" onClick={() => onPlay(item)}>
      <div
        className="lib-cont-art"
        style={item.coverUrl
          ? { backgroundImage: `url('${item.coverUrl}')` }
          : { background: gradientFor(hashHue(item.title)) }
        }
      >
        <div className="lib-cont-play">
          {isCurrent && isPlaying ? <Pause size={16} fill="white" /> : <Play size={16} fill="white" />}
        </div>
      </div>
      <div className="lib-cont-info">
        <div className="lib-cont-title">{item.title}</div>
        <div className="lib-cont-artist">{item.artistName || item.primaryArtistName || ""}</div>
        {item.progress > 0 && item.duration > 0 && (
          <div className="lib-cont-progress">
            <div className="lib-cont-bar">
              <div className="lib-cont-fill" style={{ width: `${(item.progress / item.duration) * 100}%` }} />
            </div>
            <span className="lib-cont-time">{formatTime(item.progress)}</span>
          </div>
        )}
      </div>
    </button>
  );
}

/* ─── Artist Card ────────────────────────── */
function ArtistCard({ artist, onClick }) {
  return (
    <button type="button" className="lib-artist-card" onClick={onClick}>
      <div
        className="lib-artist-avatar"
        style={artist.avatarUrl
          ? { backgroundImage: `url('${artist.avatarUrl}')` }
          : {}
        }
      >
        {!artist.avatarUrl && <Users size={20} style={{ color: "var(--text-faint)" }} />}
        {artist.badge === "verified" && <span className="lib-artist-badge">✓</span>}
      </div>
      <div className="lib-artist-name">{artist.artistName}</div>
      <div className="lib-artist-meta">{artist.followers || 0} người theo dõi</div>
    </button>
  );
}

/* ─── Playlist Card ──────────────────────── */
function PlaylistCard({ playlist, onClick }) {
  return (
    <button type="button" className="lib-playlist-card" onClick={onClick}>
      <div
        className="lib-playlist-art"
        style={playlist.coverUrl
          ? { backgroundImage: `url('${playlist.coverUrl}')` }
          : {}
        }
      >
        {!playlist.coverUrl && <ListMusic size={20} style={{ color: "var(--text-faint)" }} />}
      </div>
      <div className="lib-playlist-info">
        <div className="lib-playlist-title">{playlist.title}</div>
        <div className="lib-playlist-meta">{playlist.trackCount || 0} bài · {playlist.isPublic ? "Công khai" : "Riêng tư"}</div>
      </div>
    </button>
  );
}

/* ══════════════════════════════════════════ */
export default function LibraryPage({
  session, current, isPlaying, progress,
  onPlay, onLike, onSave, onShare, onComment, onLyrics, onAddToPlaylist,
  onOpenArtist, onOpenPlaylist, onCreatePlaylist,
}) {
  const [tab, setTab] = useState("overview");
  const [search, setSearch] = useState("");
  const [likedTracks, setLikedTracks] = useState([]);
  const [recentTracks, setRecentTracks] = useState([]);
  const [followedArtists, setFollowedArtists] = useState([]);
  const [myPlaylists, setMyPlaylists] = useState([]);
  const [continueListening, setContinueListening] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [liked, recent, artists, playlists, cont] = await Promise.all([
        api.likedTracks(50).catch((e) => { throw e; }),
        api.recentlyPlayed(30).catch((e) => { throw e; }),
        api.followedArtists(30).catch((e) => { throw e; }),
        api.myPlaylists().catch((e) => { throw e; }),
        api.continueListening(10).catch((e) => { throw e; }),
      ]);
      setLikedTracks(liked.tracks || []);
      setRecentTracks(recent.tracks || []);
      setFollowedArtists(artists.artists || []);
      setMyPlaylists(playlists.playlists || []);
      setContinueListening(cont.tracks || []);
    } catch (e) {
      setError(e.message || "Không thể tải dữ liệu thư viện.");
    }
    setLoading(false);
  }

  /* Search filter */
  const q = search.toLowerCase().trim();
  const filteredLiked = useMemo(() =>
    q ? likedTracks.filter((t) =>
      t.title.toLowerCase().includes(q) ||
      (t.primaryArtistName || "").toLowerCase().includes(q)
    ) : likedTracks, [likedTracks, q]);

  const filteredRecent = useMemo(() =>
    q ? recentTracks.filter((t) =>
      t.title.toLowerCase().includes(q) ||
      (t.primaryArtistName || "").toLowerCase().includes(q)
    ) : recentTracks, [recentTracks, q]);

  const filteredPlaylists = useMemo(() =>
    q ? myPlaylists.filter((p) => p.title.toLowerCase().includes(q)) : myPlaylists, [myPlaylists, q]);

  const filteredArtists = useMemo(() =>
    q ? followedArtists.filter((a) => a.artistName.toLowerCase().includes(q)) : followedArtists, [followedArtists, q]);

  const railProps = { session, current, isPlaying, progress, onPlay, onLike, onSave, onShare, onComment, onLyrics, onAddToPlaylist };

  function handlePlayTrack(list, index) {
    onPlay(list, index);
  }

  const isEmpty = likedTracks.length === 0 && recentTracks.length === 0 && myPlaylists.length === 0 && followedArtists.length === 0;

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="lib-page">
        <div className="lib-header">
          <h1 className="lib-title">Thư viện</h1>
        </div>
        <div className="lib-skeleton-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="lib-skeleton-card" style={{ animationDelay: `${i * 0.05}s` }} />
          ))}
        </div>
      </div>
    );
  }

  /* ── Error ── */
  if (error) {
    return (
      <div className="lib-page">
        <div className="lib-header">
          <h1 className="lib-title">Thư viện</h1>
        </div>
        <ErrorState message={error} onRetry={loadData} />
      </div>
    );
  }

  return (
    <div className="lib-page">
      {/* ── Header ── */}
      <div className="lib-header">
        <h1 className="lib-title">Thư viện</h1>
        <div className="lib-search">
          <Search size={14} />
          <input
            type="text"
            placeholder="Tìm trong thư viện..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button type="button" className="lib-search-clear" onClick={() => setSearch("")}>
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="lib-tabs">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              className={"lib-tab" + (tab === t.id ? " active" : "")}
              onClick={() => setTab(t.id)}
            >
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* ── Tab Content ── */}
      <AnimatePresence mode="wait">
        {/* ═══ OVERVIEW ═══ */}
        {tab === "overview" && (
          <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {/* Continue Listening */}
            {continueListening.length > 0 && !q && (
              <div className="lib-section">
                <h2 className="lib-section-title">Tiếp tục nghe</h2>
                <div className="lib-cont-grid">
                  {continueListening.slice(0, 6).map((item) => (
                    <ContinueCard
                      key={item.id}
                      item={item}
                      onPlay={(t) => onPlay(continueListening, continueListening.indexOf(t))}
                      isCurrent={!!current && current.trackId === item.id}
                      isPlaying={isPlaying}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Liked Songs highlight */}
            {likedTracks.length > 0 && (
              <div className="lib-section">
                <div className="lib-section-head">
                  <h2 className="lib-section-title">Bài hát đã thích</h2>
                  <button type="button" className="lib-see-all" onClick={() => setTab("liked")}>
                    Xem tất cả <ChevronRight size={14} />
                  </button>
                </div>
                <div className="lib-liked-banner" onClick={() => setTab("liked")}>
                  <div className="lib-liked-icon">
                    <Heart size={24} fill="white" />
                  </div>
                  <div className="lib-liked-info">
                    <span className="lib-liked-count">{likedTracks.length} bài hát</span>
                    <span className="lib-liked-hint">Nhấn để xem tất cả</span>
                  </div>
                </div>
              </div>
            )}

            {/* Recently Played */}
            {recentTracks.length > 0 && (
              <div className="lib-section">
                <div className="lib-section-head">
                  <h2 className="lib-section-title">Nghe gần đây</h2>
                  <button type="button" className="lib-see-all" onClick={() => setTab("recent")}>
                    Xem tất cả <ChevronRight size={14} />
                  </button>
                </div>
                <div className="lib-track-list">
                  {recentTracks.slice(0, 5).map((t, i) => (
                    <TrackRow key={t.id} track={t} index={i} list={recentTracks}
                      isCurrent={!!current && current.trackId === t.id}
                      onPlay={() => handlePlayTrack(recentTracks, i)}
                      onLike={() => onLike(t.id)} onOpenArtist={onOpenArtist}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Playlists */}
            {myPlaylists.length > 0 && (
              <div className="lib-section">
                <div className="lib-section-head">
                  <h2 className="lib-section-title">Playlist</h2>
                  <button type="button" className="lib-see-all" onClick={() => setTab("playlists")}>
                    Xem tất cả <ChevronRight size={14} />
                  </button>
                </div>
                <div className="lib-playlist-scroll">
                  {myPlaylists.slice(0, 6).map((p) => (
                    <PlaylistCard key={p.id} playlist={p} onClick={() => onOpenPlaylist?.(p.id)} />
                  ))}
                </div>
              </div>
            )}

            {/* Artists */}
            {followedArtists.length > 0 && (
              <div className="lib-section">
                <div className="lib-section-head">
                  <h2 className="lib-section-title">Nghệ sĩ theo dõi</h2>
                  <button type="button" className="lib-see-all" onClick={() => setTab("artists")}>
                    Xem tất cả <ChevronRight size={14} />
                  </button>
                </div>
                <div className="lib-artist-scroll">
                  {followedArtists.slice(0, 6).map((a) => (
                    <ArtistCard key={a.username} artist={a} onClick={() => onOpenArtist?.(a.username)} />
                  ))}
                </div>
              </div>
            )}

            {/* Empty */}
            {isEmpty && (
              <div className="lib-empty">
                <Music size={40} strokeWidth={1} style={{ color: "var(--c-sage)", opacity: 0.25 }} />
                <h3>Thư viện trống</h3>
                <p>Bắt đầu nghe nhạc, thích bài, tạo playlist và theo dõi nghệ sĩ.</p>
              </div>
            )}
          </motion.div>
        )}

        {/* ═══ LIKED ═══ */}
        {tab === "liked" && (
          <motion.div key="liked" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {filteredLiked.length > 0 ? (
              <div className="lib-track-list">
                {filteredLiked.map((t, i) => (
                  <TrackRow key={t.id} track={t} index={i} list={filteredLiked}
                    isCurrent={!!current && current.trackId === t.id}
                    onPlay={() => handlePlayTrack(filteredLiked, i)}
                    onLike={() => onLike(t.id)} onOpenArtist={onOpenArtist}
                  />
                ))}
              </div>
            ) : (
              <div className="lib-empty">
                <Heart size={40} strokeWidth={1} style={{ color: "var(--c-sage)", opacity: 0.25 }} />
                <h3>{q ? "Không tìm thấy" : "Chưa thích bài nào"}</h3>
                <p>{q ? "Thử từ khóa khác." : "Thả tym trên một bài hát để lưu lại đây."}</p>
              </div>
            )}
          </motion.div>
        )}

        {/* ═══ PLAYLISTS ═══ */}
        {tab === "playlists" && (
          <motion.div key="playlists" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {filteredPlaylists.length > 0 ? (
              <div className="lib-playlist-grid">
                {filteredPlaylists.map((p) => (
                  <PlaylistCard key={p.id} playlist={p} onClick={() => onOpenPlaylist?.(p.id)} />
                ))}
              </div>
            ) : (
              <div className="lib-empty">
                <ListMusic size={40} strokeWidth={1} style={{ color: "var(--c-sage)", opacity: 0.25 }} />
                <h3>{q ? "Không tìm thấy" : "Chưa có playlist"}</h3>
                <p>{q ? "Thử từ khóa khác." : "Tạo playlist để tổ chức nhạc yêu thích."}</p>
                {!q && onCreatePlaylist && (
                  <button type="button" className="btn-primary btn-sm" onClick={onCreatePlaylist} style={{ marginTop: "var(--sp-2)" }}>
                    <Plus size={14} /> Tạo playlist mới
                  </button>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* ═══ ARTISTS ═══ */}
        {tab === "artists" && (
          <motion.div key="artists" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {filteredArtists.length > 0 ? (
              <div className="lib-artist-grid">
                {filteredArtists.map((a) => (
                  <ArtistCard key={a.username} artist={a} onClick={() => onOpenArtist?.(a.username)} />
                ))}
              </div>
            ) : (
              <div className="lib-empty">
                <Users size={40} strokeWidth={1} style={{ color: "var(--c-sage)", opacity: 0.25 }} />
                <h3>{q ? "Không tìm thấy" : "Chưa theo dõi nghệ sĩ nào"}</h3>
                <p>{q ? "Thử từ khóa khác." : "Theo dõi nghệ sĩ để cập nhật bài mới."}</p>
              </div>
            )}
          </motion.div>
        )}

        {/* ═══ RECENT ═══ */}
        {tab === "recent" && (
          <motion.div key="recent" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {filteredRecent.length > 0 ? (
              <div className="lib-track-list">
                {filteredRecent.map((t, i) => (
                  <TrackRow key={t.id} track={t} index={i} list={filteredRecent}
                    isCurrent={!!current && current.trackId === t.id}
                    onPlay={() => handlePlayTrack(filteredRecent, i)}
                    onLike={() => onLike(t.id)} onOpenArtist={onOpenArtist}
                  />
                ))}
              </div>
            ) : (
              <div className="lib-empty">
                <Clock size={40} strokeWidth={1} style={{ color: "var(--c-sage)", opacity: 0.25 }} />
                <h3>{q ? "Không tìm thấy" : "Chưa có lịch sử nghe"}</h3>
                <p>{q ? "Thử từ khóa khác." : "Bài bạn nghe sẽ xuất hiện ở đây."}</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Track Row (shared list item) ───────── */
function TrackRow({ track, index, list, isCurrent, onPlay, onLike, onOpenArtist }) {
  return (
    <div className={"lib-track-row" + (isCurrent ? " lib-row-active" : "")} onClick={onPlay}>
      <span className="lib-row-num">
        {isCurrent ? (
          <span className="lib-eq"><span /><span /><span /></span>
        ) : (index + 1)}
      </span>
      <div
        className="lib-row-art"
        style={track.coverUrl
          ? { backgroundImage: `url('${track.coverUrl}')` }
          : { background: gradientFor(hashHue(track.title)) }
        }
      />
      <div className="lib-row-info">
        <div className={"lib-row-title" + (isCurrent ? " lib-row-playing" : "")}>{track.title}</div>
        <div className="lib-row-artist">
          {onOpenArtist && track.uploaderUsername ? (
            <span className="lib-artist-link" onClick={(e) => { e.stopPropagation(); onOpenArtist(track.uploaderUsername); }}>
              {track.primaryArtistName || "Unknown"}
            </span>
          ) : (track.primaryArtistName || "Unknown")}
        </div>
      </div>
      <span className="lib-row-duration">{formatTime(track.duration || 0)}</span>
      <button type="button" className="lib-row-like" onClick={(e) => { e.stopPropagation(); onLike(); }} aria-label="Thích">
        <Heart size={14} />
      </button>
    </div>
  );
}
