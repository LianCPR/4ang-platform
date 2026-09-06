/**
 * Phase 2.2 — RoomPage
 *
 * Full room experience: now-playing via global player, queue, participants,
 * reactions, share/invite, host controls. The room is a synchronization
 * layer around the existing global player (no second audio player).
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "../api";
import { useRoomSync, createDriftCorrector } from "../lib/room-sync";

const ALLOWED_REACTIONS = ["❤️", "🔥", "🎵", "👏"];
const SEEK_INPUT_MS = 1000; // maps slider 0..1000 to 0..duration

export default function RoomPage({
  roomId, session, tracks, showToast, goBack,
  current, isPlaying, progress, playTrackAtIndex, togglePlayPause, handleSeek: playerHandleSeek,
  handleNext, handlePrev, audioRef, ytPlayerRef,
  onOpenArtist,
}) {
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showQueue, setShowQueue] = useState(true);
  const [showParticipants, setShowParticipants] = useState(true);
  const [addTrackSearch, setAddTrackSearch] = useState("");
  const [showAddTrack, setShowAddTrack] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteUsername, setInviteUsername] = useState("");
  const [shareTooltip, setShareTooltip] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const lastPlayedTrackRef = useRef(null);

  const isHost = room?.isHost;
  const isMember = room?.isMember;

  const onTrackChange = useCallback((trackId) => {
    if (!room) return;
    // Find track object from global tracks list
    const trackObj = tracks?.find(t => String(t.id) === String(trackId));
    if (!trackObj) return;
    if (lastPlayedTrackRef.current === trackId) return; // already playing
    lastPlayedTrackRef.current = trackId;
    playTrackAtIndex([trackObj], 0);
  }, [room, tracks, playTrackAtIndex]);

  const roomSync = useRoomSync(roomId, { session, isHost, onTrackChange });

  // Drift correction (participants only)
  useEffect(() => {
    if (isHost || !roomSync.isPlaying || !audioRef?.current) return;
    const correct = createDriftCorrector(audioRef, ytPlayerRef, () => current?.source || "local");
    const interval = setInterval(() => {
      if (roomSync.playback.currentTrackId && roomSync.playback.syncedAt) {
        const target = roomSync.playback.positionMs / 1000 + (Date.now() - roomSync.playback.syncedAt) / 1000;
        correct(target);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [isHost, roomSync.isPlaying, roomSync.playback.currentTrackId, current?.source, audioRef, ytPlayerRef]);

  // Fetch initial room data
  useEffect(() => {
    if (!roomId) return;
    setLoading(true);
    api.rooms.get(roomId).then(res => {
      if (res.ok) setRoom(res.room);
      else showToast(res.error || "Không tìm thấy phòng.");
    }).catch(e => showToast(e.message));
    setLoading(false);
  }, [roomId]);

  // Host: sync playback state to server whenever local player changes
  useEffect(() => {
    if (!isHost || !room || !current?.trackId) return;
    const syncToServer = async () => {
      try {
        await api.rooms.sync(roomId, {
          positionMs: Math.round(progress.cur * 1000),
          isPlaying,
          currentTrackId: current.trackId,
          queueVersion: room.queueVersion,
        });
        // Broadcast to participants for instant reaction
        roomSync.broadcastSync({
          isPlaying,
          positionMs: Math.round(progress.cur * 1000),
          currentTrackId: current.trackId,
          queueVersion: room.queueVersion,
          playbackStartedAt: new Date().toISOString(),
          syncedAt: new Date().toISOString(),
        });
      } catch {}
    };
    // Sync on track change or play/pause toggle (debounced by the effect dependency)
    syncToServer();
  }, [isHost, current?.trackId, isPlaying, room?.queueVersion]);

  // Host: periodic sync every 10s
  useEffect(() => {
    if (!isHost) return;
    const timer = setInterval(async () => {
      if (!current?.trackId) return;
      try {
        await api.rooms.sync(roomId, {
          positionMs: Math.round(progress.cur * 1000),
          isPlaying,
          currentTrackId: current.trackId,
          queueVersion: roomSync.playback.queueVersion,
        });
        roomSync.broadcastSync({
          isPlaying,
          positionMs: Math.round(progress.cur * 1000),
          currentTrackId: current.trackId,
          queueVersion: roomSync.playback.queueVersion,
          playbackStartedAt: new Date().toISOString(),
          syncedAt: new Date().toISOString(),
        });
      } catch {}
    }, 10_000);
    return () => clearInterval(timer);
  }, [isHost, current?.trackId, isPlaying, progress.cur, roomSync.playback.queueVersion]);

  // ── room actions ─────────────────────────────────────────────────

  async function handleJoin() {
    setJoining(true);
    try {
      const res = await api.rooms.join(roomId, joinCodeInput || undefined);
      if (res.room) {
        setRoom(res.room);
        showToast("Đã tham gia phòng!");
      }
    } catch (e) { showToast(e.message); }
    setJoining(false);
  }

  async function handleLeave() {
    try {
      await api.rooms.leave(roomId);
      showToast("Đã rời phòng.");
      goBack();
    } catch (e) { showToast(e.message); }
  }

  async function handleEndRoom() {
    if (!confirm("Kết thúc phòng này?")) return;
    try {
      await api.rooms.end(roomId);
      showToast("Phòng đã kết thúc.");
      goBack();
    } catch (e) { showToast(e.message); }
  }

  async function handleHostPlayTrack(trackId) {
    if (!isHost) return;
    try {
      const res = await api.rooms.play(roomId, trackId, 0);
      if (res.ok) {
        const trackObj = tracks?.find(t => String(t.id) === String(trackId));
        if (trackObj) {
          lastPlayedTrackRef.current = trackId;
          playTrackAtIndex([trackObj], 0);
        }
      }
    } catch (e) { showToast(e.message); }
  }

  async function handleHostPause() {
    if (!isHost) return;
    const posMs = Math.round(progress.cur * 1000);
    try {
      await api.rooms.pause(roomId, posMs);
      togglePlayPause();
    } catch (e) { showToast(e.message); }
  }

  async function handleHostSeek(val) {
    if (!isHost) return;
    const posMs = Math.round((val / SEEK_INPUT_MS) * progress.dur * 1000);
    try {
      await api.rooms.seek(roomId, posMs);
      playerHandleSeek(val);
    } catch (e) { showToast(e.message); }
  }

  async function handleHostNext() {
    if (!isHost) return;
    try {
      await api.rooms.next(roomId);
      handleNext();
    } catch (e) { showToast(e.message); }
  }

  async function handleHostPrev() {
    if (!isHost) return;
    try {
      await api.rooms.prev(roomId);
      handlePrev();
    } catch (e) { showToast(e.message); }
  }

  async function handleHostShuffle() {
    if (!isHost) return;
    try {
      const res = await api.rooms.shuffle(roomId);
      if (res.ok) {
        showToast("Đã trộn hàng chờ.");
        const full = await api.rooms.get(roomId);
        if (full.ok) setRoom(full.room);
      }
    } catch (e) { showToast(e.message); }
  }

  async function handleAddToQueue(trackId) {
    try {
      await api.rooms.addToQueue(roomId, trackId);
      showToast("Đã thêm vào hàng chờ.");
      setShowAddTrack(false);
      setAddTrackSearch("");
      const full = await api.rooms.get(roomId);
      if (full.ok) setRoom(full.room);
    } catch (e) { showToast(e.message); }
  }

  async function handleRemoveFromQueue(queueId) {
    try {
      await api.rooms.removeFromQueue(roomId, queueId);
      const full = await api.rooms.get(roomId);
      if (full.ok) setRoom(full.room);
    } catch (e) { showToast(e.message); }
  }

  async function handleReact(emoji) {
    try {
      await api.rooms.react(roomId, emoji);
      roomSync.broadcastReaction(emoji, session.username);
    } catch (e) { showToast(e.message); }
  }

  async function handleInvite() {
    if (!inviteUsername.trim()) return;
    try {
      await api.rooms.invite(roomId, inviteUsername.trim());
      showToast(`Đã mời ${inviteUsername.trim()}.`);
      setInviteUsername("");
      setShowInvite(false);
    } catch (e) { showToast(e.message); }
  }

  function handleShare() {
    const url = `${window.location.origin}/rooms/${roomId}`;
    if (navigator.share) {
      navigator.share({ title: room?.name || "Phòng nhạc", url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => {
        setShareTooltip("Đã copy link!");
        setTimeout(() => setShareTooltip(""), 2000);
      }).catch(() => {});
    }
  }

  // ── search tracks for adding to queue ───────────────────────────

  const searchResults = addTrackSearch.trim().length > 0
    ? (tracks || []).filter(t =>
        t.title.toLowerCase().includes(addTrackSearch.toLowerCase()) ||
        (t.primaryArtistName || "").toLowerCase().includes(addTrackSearch.toLowerCase())
      ).slice(0, 8)
    : [];

  // ── resolve current track from queue ────────────────────────────

  const currentTrackObj = tracks?.find(t => String(t.id) === String(roomSync.playback.currentTrackId));

  // ── render ──────────────────────────────────────────────────────

  if (loading) {
    return <div className="room-page"><div className="room-loading">Đang tải phòng...</div></div>;
  }

  if (!room) {
    return (
      <div className="room-page">
        <div className="room-error">
          <p>Không tìm thấy phòng hoặc phòng đã kết thúc.</p>
          <button className="btn-primary" onClick={goBack}>Quay lại</button>
        </div>
      </div>
    );
  }

  // Not a member — show join screen
  if (!isMember) {
    return (
      <div className="room-page">
        <button className="room-back-btn" onClick={goBack}>← Quay lại</button>
        <div className="room-join-screen">
          <h2>{room.name}</h2>
          <p className="room-join-host">Tạo bởi {room.hostUsername}</p>
          {room.privacy === "private" && (
            <div className="room-join-code-input">
              <input
                className="input"
                placeholder="Nhập mã tham gia..."
                value={joinCodeInput}
                onChange={e => setJoinCodeInput(e.target.value)}
              />
            </div>
          )}
          <button className="btn-primary" onClick={handleJoin} disabled={joining}>
            {joining ? "Đang tham gia..." : "Tham gia phòng"}
          </button>
        </div>
      </div>
    );
  }

  // Member — full room view
  return (
    <div className="room-page">
      {/* Header */}
      <div className="room-header">
        <button className="room-back-btn" onClick={goBack}>←</button>
        <div className="room-header-info">
          <h2 className="room-name">{room.name}</h2>
          <span className={`room-privacy-badge ${room.privacy}`}>
            {room.privacy === "private" ? "🔒 Riêng tư" : "🌍 Công khai"}
          </span>
        </div>
        <div className="room-header-actions">
          <span className={`room-connection-dot ${roomSync.isConnected ? "connected" : "disconnected"}`}
                title={roomSync.connectionMethod === "realtime" ? "Realtime" : "Polling"} />
          <button className="room-icon-btn" onClick={handleShare} title="Chia sẻ">↗</button>
          <span className="room-share-tooltip">{shareTooltip}</span>
          {isHost ? (
            <button className="room-icon-btn room-end-btn" onClick={handleEndRoom} title="Kết thúc phòng">✕</button>
          ) : (
            <button className="room-icon-btn room-leave-btn" onClick={handleLeave} title="Rời phòng">⊘</button>
          )}
        </div>
      </div>

      {/* Main layout */}
      <div className="room-body">
        {/* Left: Now Playing + Queue */}
        <div className="room-main">
          {/* Now Playing */}
          <div className="room-now-playing">
            {currentTrackObj ? (
              <div className="room-np-content">
                <img
                  className="room-np-cover"
                  src={currentTrackObj.coverUrl || "/default-cover.png"}
                  alt={currentTrackObj.title}
                />
                <div className="room-np-info">
                  <h3 className="room-np-title">{currentTrackObj.title}</h3>
                  <p className="room-np-artist">{currentTrackObj.primaryArtistName || ""}</p>
                  {roomSync.playback.isPlaying && (
                    <span className="room-np-playing">Đang phát...</span>
                  )}
                </div>
                {/* Host playback controls */}
                {isHost && (
                  <div className="room-host-controls">
                    <button className="room-ctrl-btn" onClick={handleHostPrev} title="Trước">⏮</button>
                    <button className="room-ctrl-btn room-play-btn" onClick={handleHostPause}>
                      {roomSync.playback.isPlaying ? "⏸" : "▶"}
                    </button>
                    <button className="room-ctrl-btn" onClick={handleHostNext} title="Tiếp">⏭</button>
                    <button className="room-ctrl-btn" onClick={handleHostShuffle} title="Trộn">🔀</button>
                    <input
                      className="room-seek-slider"
                      type="range" min="0" max={SEEK_INPUT_MS}
                      value={Math.round((progress.cur / Math.max(progress.dur, 1)) * SEEK_INPUT_MS)}
                      onChange={e => handleHostSeek(Number(e.target.value))}
                    />
                    <span className="room-time">
                      {formatTime(progress.cur)} / {formatTime(progress.dur)}
                    </span>
                  </div>
                )}
                {!isHost && (
                  <div className="room-participant-controls">
                    <button className="room-ctrl-btn room-play-btn" onClick={togglePlayPause}>
                      {isPlaying ? "⏸" : "▶"}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="room-np-empty">
                <p>Chưa có bài nào đang phát.</p>
                {isHost && <p className="room-np-hint">Chọn bài từ hàng chờ để bắt đầu.</p>}
              </div>
            )}
          </div>

          {/* Queue */}
          <div className="room-queue-section">
            <div className="room-queue-header" onClick={() => setShowQueue(v => !v)}>
              <h3>Hàng chờ ({roomSync.queue.length})</h3>
              <span>{showQueue ? "▾" : "▸"}</span>
            </div>
            {showQueue && (
              <div className="room-queue-list">
                {roomSync.queue.length === 0 ? (
                  <p className="room-queue-empty">Hàng chờ trống.</p>
                ) : (
                  roomSync.queue.map((item, idx) => {
                    const t = tracks?.find(tr => String(tr.id) === String(item.trackId));
                    const isCurrent = item.trackId === roomSync.playback.currentTrackId;
                    return (
                      <div key={item.id} className={`room-queue-item ${isCurrent ? "current" : ""}`}>
                        <span className="room-queue-pos">{isCurrent ? "♫" : idx + 1}</span>
                        <div className="room-queue-track-info">
                          <span className="room-queue-title">{t?.title || "..."}</span>
                          <span className="room-queue-artist">{t?.primaryArtistName || item.addedBy || ""}</span>
                        </div>
                        {isHost && !isCurrent && (
                          <div className="room-queue-actions">
                            <button className="room-q-btn" onClick={() => handleHostPlayTrack(item.trackId)} title="Phát">▶</button>
                            <button className="room-q-btn" onClick={() => handleRemoveFromQueue(item.id)} title="Xóa">✕</button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
                {/* Add track */}
                <div className="room-add-track-wrap">
                  <button className="btn-secondary room-add-track-btn" onClick={() => setShowAddTrack(v => !v)}>
                    + Thêm bài
                  </button>
                  {showAddTrack && (
                    <>
                      <input
                        className="input room-add-track-search"
                        placeholder="Tìm bài..."
                        value={addTrackSearch}
                        onChange={e => setAddTrackSearch(e.target.value)}
                      />
                      {searchResults.length > 0 && (
                        <div className="room-add-track-results">
                          {searchResults.map(t => (
                            <button key={t.id} className="room-add-track-item" onClick={() => handleAddToQueue(t.id)}>
                              <span>{t.title}</span>
                              <span className="room-add-track-artist">{t.primaryArtistName || ""}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Participants + Reactions + Invite */}
        <div className="room-sidebar">
          {/* Participants */}
          <div className="room-participants-section">
            <div className="room-participants-header" onClick={() => setShowParticipants(v => !v)}>
              <h3>Thành viên ({roomSync.participants.length})</h3>
              <span>{showParticipants ? "▾" : "▸"}</span>
            </div>
            {showParticipants && (
              <div className="room-participants-list">
                {roomSync.participants.map(p => (
                  <div key={p.username} className="room-participant">
                    <img
                      className="room-participant-avatar"
                      src={p.avatarUrl || "/default-avatar.png"}
                      alt={p.displayName}
                      onClick={() => onOpenArtist?.(p.username)}
                    />
                    <div className="room-participant-info">
                      <span className="room-participant-name">{p.displayName}</span>
                      {p.role === "host" && <span className="room-host-badge">Chủ phòng</span>}
                    </div>
                    <span className={`room-online-dot ${p.isOnline ? "online" : ""}`} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Reactions */}
          <div className="room-reactions-section">
            <h3>Reaction</h3>
            <div className="room-reactions-bar">
              {ALLOWED_REACTIONS.map(emoji => (
                <button key={emoji} className="room-reaction-btn" onClick={() => handleReact(emoji)}>
                  {emoji}
                </button>
              ))}
            </div>
            {roomSync.reactions.length > 0 && (
              <div className="room-reactions-display">
                {roomSync.reactions.slice(-10).map((r, i) => (
                  <span key={r.id || i} className="room-reaction-float">
                    <span className="room-reaction-emoji">{r.emoji}</span>
                    <span className="room-reaction-user">{r.username}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Invite */}
          {isHost && (
            <div className="room-invite-section">
              <button className="btn-secondary" onClick={() => setShowInvite(v => !v)}>
                Mời thành viên
              </button>
              {showInvite && (
                <div className="room-invite-form">
                  <input
                    className="input"
                    placeholder="Tên người dùng..."
                    value={inviteUsername}
                    onChange={e => setInviteUsername(e.target.value)}
                  />
                  <button className="btn-primary" onClick={handleInvite}>Gửi lời mời</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatTime(sec) {
  if (!sec || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
