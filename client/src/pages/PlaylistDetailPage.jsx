import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Play, Pause, Shuffle, Edit3, Trash2, Lock, Globe, Plus, X,
  GripVertical, ListMusic, Clock, Music, Upload, ChevronDown, MoreHorizontal, Share2
} from "lucide-react";
import { api } from "../api";
import { gradientFor, hashHue, formatTime, timeAgo } from "../lib/format";

/* ─── Track Row ──────────────────────────── */
function TrackRow({ track, index, isCurrent, isPlaying, isOwner, onPlay, onRemove, onLike, onOpenArtist, onMoveUp, onMoveDown, isFirst, isLast }) {
  return (
    <div className={"pl-track-row" + (isCurrent ? " pl-row-active" : "")} onClick={onPlay}>
      <div className="pl-row-num">
        {isCurrent && isPlaying ? (
          <span className="pl-eq"><span /><span /><span /></span>
        ) : (
          <span className="pl-row-idx">{index + 1}</span>
        )}
      </div>
      {isOwner && (
        <div className="pl-row-reorder" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="pl-reorder-btn" onClick={onMoveUp} disabled={isFirst} aria-label="Di chuyển lên" title="Di chuyển lên">
            ▲
          </button>
          <button type="button" className="pl-reorder-btn" onClick={onMoveDown} disabled={isLast} aria-label="Di chuyển xuống" title="Di chuyển xuống">
            ▼
          </button>
        </div>
      )}
      <div
        className="pl-row-art"
        style={track.coverUrl
          ? { backgroundImage: `url('${track.coverUrl}')` }
          : { background: gradientFor(hashHue(track.title)) }
        }
      />
      <div className="pl-row-info">
        <div className={"pl-row-title" + (isCurrent ? " pl-row-playing" : "")}>{track.title}</div>
        <div className="pl-row-artist">
          {onOpenArtist && track.uploaderUsername ? (
            <span className="pl-artist-link" onClick={(e) => { e.stopPropagation(); onOpenArtist(track.uploaderUsername); }}>
              {track.primaryArtistName || "Unknown"}
            </span>
          ) : (track.primaryArtistName || "Unknown")}
        </div>
      </div>
      <span className="pl-row-duration">{formatTime(track.duration || 0)}</span>
      <button type="button" className="pl-row-like" onClick={(e) => { e.stopPropagation(); onLike(); }} aria-label="Thích">
        ♡
      </button>
      {isOwner && (
        <button type="button" className="pl-row-remove" onClick={(e) => { e.stopPropagation(); onRemove(); }} aria-label="Xoá">
          <X size={14} />
        </button>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════ */
export default function PlaylistDetailPage({
  playlistId, session, current, isPlaying, progress,
  onClose, onPlay, onLike, onSave, onShare, onComment, onLyrics,
  onOpenArtist, onSharePlaylist, showToast,
}) {
  const [playlist, setPlaylist] = useState(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editPublic, setEditPublic] = useState(true);
  const [saving, setSaving] = useState(false);
  const [shuffled, setShuffled] = useState(false);
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const coverInputRef = useRef(null);

  useEffect(() => {
    if (!playlistId) return;
    let cancelled = false;
    setPlaylist(null);
    setError("");
    setEditing(false);
    setShuffled(false);
    api.playlist(playlistId).then((res) => {
      if (!cancelled) {
        setPlaylist(res.playlist);
        setEditTitle(res.playlist.title);
        setEditDesc(res.playlist.description || "");
        setEditPublic(res.playlist.isPublic);
      }
    }).catch((err) => {
      if (!cancelled) setError(err.message);
    });
    return () => { cancelled = true; };
  }, [playlistId]);

  async function handleSave() {
    if (!playlist) return;
    setSaving(true);
    try {
      const res = await api.updatePlaylist(playlist.id, { title: editTitle, description: editDesc, isPublic: editPublic });
      setPlaylist(res.playlist);
      setEditing(false);
      showToast && showToast("Đã cập nhật playlist.");
    } catch (e) {
      showToast && showToast(e.message);
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!playlist || !confirm("Xoá playlist này?")) return;
    try {
      await api.deletePlaylist(playlist.id);
      onClose && onClose();
      showToast && showToast("Đã xoá playlist.");
    } catch (e) {
      showToast && showToast(e.message);
    }
  }

  async function handleRemoveTrack(trackId) {
    if (!playlist) return;
    try {
      const res = await api.removeFromPlaylist(playlist.id, trackId);
      setPlaylist(res.playlist);
      showToast && showToast("Đã xoá bài hát.");
    } catch (e) {
      showToast && showToast(e.message);
    }
  }

  async function handleMoveTrack(fromIndex, toIndex) {
    if (!playlist || !playlist.tracks) return;
    const tracks = [...playlist.tracks];
    if (toIndex < 0 || toIndex >= tracks.length) return;
    const [moved] = tracks.splice(fromIndex, 1);
    tracks.splice(toIndex, 0, moved);
    // Update local state immediately for smooth UX
    setPlaylist({ ...playlist, tracks });
    // Persist to server
    const order = tracks.map((t) => t.id);
    try {
      await api.reorderPlaylist(playlist.id, order);
    } catch (e) {
      // Revert on error
      showToast && showToast(e.message);
    }
  }

  async function handleCoverUpload(e) {
    const file = e.target.files && e.target.files[0];
    if (!file || !playlist) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    try {
      const res = await api.uploadPlaylistCover(playlist.id, file);
      setPlaylist(res.playlist);
      showToast && showToast("Đã cập nhật ảnh bìa.");
    } catch (err) {
      showToast && showToast(err.message);
      setCoverPreview(null);
    }
    setCoverFile(null);
  }

  function playAll() {
    if (!playlist || !playlist.tracks || playlist.tracks.length === 0) return;
    const tracks = shuffled ? [...playlist.tracks].sort(() => Math.random() - 0.5) : playlist.tracks;
    onPlay(tracks, 0);
  }

  function shufflePlay() {
    if (!playlist || !playlist.tracks || playlist.tracks.length === 0) return;
    setShuffled(true);
    // Smart shuffle: avoid same artist consecutive when possible
    const tracks = [...playlist.tracks];
    for (let i = tracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
    }
    // Try to avoid same artist consecutive
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 1; i < tracks.length; i++) {
        const prev = tracks[i - 1];
        const curr = tracks[i];
        if ((prev.uploaderUsername || prev.primaryArtistName) === (curr.uploaderUsername || curr.primaryArtistName)) {
          // Find next track with different artist and swap
          for (let j = i + 1; j < tracks.length; j++) {
            if ((tracks[j].uploaderUsername || tracks[j].primaryArtistName) !== (prev.uploaderUsername || prev.primaryArtistName)) {
              [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
              break;
            }
          }
        }
      }
    }
    onPlay(tracks, 0);
  }

  const isOwner = session && playlist && playlist.ownerUsername === session.username;
  const totalDuration = playlist && playlist.tracks
    ? playlist.tracks.reduce((sum, t) => sum + (t.duration || 0), 0)
    : 0;

  /* ── Error ── */
  if (error) {
    return (
      <motion.div className="pl-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <motion.div className="pl-container" initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 16, opacity: 0 }}>
          <button type="button" className="pl-close" onClick={onClose}><X size={20} /></button>
          <div className="pl-empty">
            <Music size={40} strokeWidth={1} style={{ color: "var(--c-sage)", opacity: 0.25 }} />
            <h3>Không tìm thấy playlist</h3>
            <p>{error}</p>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  /* ── Loading ── */
  if (!playlist) {
    return (
      <motion.div className="pl-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <motion.div className="pl-container" initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 16, opacity: 0 }}>
          <button type="button" className="pl-close" onClick={onClose}><X size={20} /></button>
          <div className="pl-loading">Đang tải...</div>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div className="pl-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
      <motion.div className="pl-container" initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 16, opacity: 0 }} transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}>
        <button type="button" className="pl-close" onClick={onClose} aria-label="Đóng"><X size={20} /></button>

        {/* ── Cover ── */}
        <div className="pl-cover-wrap">
          <div
            className="pl-cover"
            style={(coverPreview || playlist.coverUrl)
              ? { backgroundImage: `url('${coverPreview || playlist.coverUrl}')` }
              : {}
            }
          >
            {!(coverPreview || playlist.coverUrl) && <ListMusic size={48} style={{ opacity: 0.3, color: "var(--text-faint)" }} />}
          </div>
          {isOwner && (
            <button type="button" className="pl-cover-edit" onClick={() => coverInputRef.current?.click()}>
              <Upload size={14} /> Đổi ảnh
            </button>
          )}
          <input ref={coverInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleCoverUpload} />
        </div>

        {/* ── Info ── */}
        <div className="pl-info">
          {editing ? (
            <div className="pl-edit-form">
              <input type="text" className="pl-edit-title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} maxLength={100} placeholder="Tên playlist" />
              <textarea className="pl-edit-desc" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={2} maxLength={500} placeholder="Mô tả (tùy chọn)" />
              <div className="pl-edit-actions">
                <label className="pl-visibility-toggle">
                  <input type="checkbox" checked={editPublic} onChange={(e) => setEditPublic(e.target.checked)} />
                  <span>{editPublic ? <Globe size={13} /> : <Lock size={13} />} {editPublic ? "Công khai" : "Riêng tư"}</span>
                </label>
                <div className="pl-edit-buttons">
                  <button type="button" className="btn-primary btn-sm" onClick={handleSave} disabled={saving || !editTitle.trim()}>
                    {saving ? "Đang lưu..." : "Lưu"}
                  </button>
                  <button type="button" className="btn-secondary btn-sm" onClick={() => { setEditing(false); setEditTitle(playlist.title); setEditDesc(playlist.description || ""); setEditPublic(playlist.isPublic); }}>
                    Huỷ
                  </button>
                  <button type="button" className="btn-secondary btn-sm pl-delete-btn" onClick={handleDelete}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="pl-title-row">
                <h1 className="pl-title">{playlist.title}</h1>
                {isOwner && (
                  <button type="button" className="pl-edit-btn" onClick={() => setEditing(true)}>
                    <Edit3 size={14} /> Chỉnh sửa
                  </button>
                )}
              </div>
              <div className="pl-meta">
                {playlist.isPublic ? <Globe size={12} /> : <Lock size={12} />}
                <span>{playlist.trackCount || 0} bài</span>
                <span>·</span>
                <span>{playlist.ownerDisplayName || playlist.ownerUsername}</span>
                {totalDuration > 0 && <><span>·</span><span>{formatTime(totalDuration)}</span></>}
              </div>
              {playlist.description && <p className="pl-desc">{playlist.description}</p>}
            </>
          )}
        </div>

        {/* ── Controls ── */}
        {playlist.tracks && playlist.tracks.length > 0 && (
          <div className="pl-controls">
            <button type="button" className="pl-play-btn" onClick={playAll}>
              {isPlaying ? <Pause size={18} fill="white" /> : <Play size={18} fill="white" />}
            </button>
            <button type="button" className={"pl-shuffle-btn" + (shuffled ? " active" : "")} onClick={shufflePlay}>
              <Shuffle size={16} />
            </button>
            {onSharePlaylist && (
              <button type="button" className="pl-shuffle-btn" onClick={() => onSharePlaylist({ id: playlist.id, title: playlist.name, coverUrl: playlist.coverUrl })} aria-label="Chia sẻ playlist">
                <Share2 size={16} />
              </button>
            )}
          </div>
        )}

        {/* ── Track List ── */}
        <div className="pl-tracks">
          {(!playlist.tracks || playlist.tracks.length === 0) ? (
            <div className="pl-empty-tracks">
              <Music size={28} style={{ opacity: 0.15, color: "var(--c-sage)" }} />
              <p>{isOwner ? "Thêm bài hát từ menu của một bài." : "Playlist chưa có bài hát."}</p>
            </div>
          ) : (
            playlist.tracks.map((t, i) => (
              <TrackRow
                key={t.id}
                track={t}
                index={i}
                isCurrent={!!current && current.trackId === t.id}
                isPlaying={isPlaying}
                isOwner={isOwner}
                onPlay={() => onPlay(playlist.tracks, i)}
                onRemove={() => handleRemoveTrack(t.id)}
                onLike={() => onLike(t.id)}
                onOpenArtist={onOpenArtist}
                onMoveUp={() => handleMoveTrack(i, i - 1)}
                onMoveDown={() => handleMoveTrack(i, i + 1)}
                isFirst={i === 0}
                isLast={i === playlist.tracks.length - 1}
              />
            ))
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
