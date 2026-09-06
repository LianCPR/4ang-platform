/**
 * Phase 2.2 — RoomsPage (discovery + create flow)
 */
import { useState, useEffect, useCallback } from "react";
import { api } from "../api";

const INITIAL_ROOM = { name: "", description: "", privacy: "public", initialTrackId: "" };

export default function RoomsPage({ session, showToast, onOpenRoom, tracks }) {
  const [rooms, setRooms] = useState([]);
  const [myRooms, setMyRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("discover");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(INITIAL_ROOM);
  const [creatingSubmit, setCreatingSubmit] = useState(false);

  const fetchRooms = useCallback(async () => {
    try {
      const [discRes, mineRes] = await Promise.all([
        api.rooms.discovery(30),
        api.rooms.mine(),
      ]);
      setRooms(discRes.rooms || []);
      setMyRooms(mineRes.rooms || []);
    } catch (e) { console.warn("[rooms]", e); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchRooms(); }, [fetchRooms]);

  async function handleCreate() {
    if (!form.name.trim()) return showToast("Nhập tên phòng.");
    setCreatingSubmit(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        privacy: form.privacy,
        initialTrackId: form.initialTrackId || undefined,
      };
      const res = await api.rooms.create(payload);
      if (res.room) {
        showToast("Tạo phòng thành công!");
        setCreating(false);
        setForm(INITIAL_ROOM);
        onOpenRoom(res.room.id);
      }
    } catch (e) { showToast(e.message); }
    setCreatingSubmit(false);
  }

  function handleTrackSearch(e) {
    const val = e.target.value;
    setForm(f => ({ ...f, initialTrackId: "", initialTrackSearch: val }));
  }

  const filteredTracks = form.initialTrackSearch
    ? (tracks || []).filter(t =>
        t.title.toLowerCase().includes(form.initialTrackSearch.toLowerCase()) ||
        (t.primaryArtistName || "").toLowerCase().includes(form.initialTrackSearch.toLowerCase())
      ).slice(0, 5)
    : [];

  return (
    <div className="rooms-page">
      <div className="rooms-header">
        <h2>Phòng nhạc</h2>
        {session && (
          <button className="btn-primary" onClick={() => setCreating(true)}>
            + Tạo phòng
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="rooms-tabs">
        <button className={`rooms-tab ${tab === "discover" ? "active" : ""}`} onClick={() => setTab("discover")}>
          Khám phá
        </button>
        <button className={`rooms-tab ${tab === "mine" ? "active" : ""}`} onClick={() => setTab("mine")}>
          Phòng của tôi
        </button>
      </div>

      {/* Create Room Modal */}
      {creating && (
        <div className="modal-backdrop" onClick={() => setCreating(false)}>
          <div className="modal-content rooms-create-modal" onClick={e => e.stopPropagation()}>
            <h3>Tạo phòng nhạc</h3>
            <input
              className="input"
              placeholder="Tên phòng *"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              maxLength={80}
            />
            <input
              className="input"
              placeholder="Mô tả (tuỳ chọn)"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              maxLength={300}
            />
            <div className="rooms-privacy-toggle">
              <button
                className={`toggle-btn ${form.privacy === "public" ? "active" : ""}`}
                onClick={() => setForm(f => ({ ...f, privacy: "public" }))}
              >
                🌍 Công khai
              </button>
              <button
                className={`toggle-btn ${form.privacy === "private" ? "active" : ""}`}
                onClick={() => setForm(f => ({ ...f, privacy: "private" }))}
              >
                🔒 Riêng tư
              </button>
            </div>
            <div className="rooms-track-search-wrap">
              <input
                className="input"
                placeholder="Bài hát mở đầu (tuỳ chọn)"
                value={form.initialTrackSearch || ""}
                onChange={handleTrackSearch}
              />
              {filteredTracks.length > 0 && (
                <div className="rooms-track-search-results">
                  {filteredTracks.map(t => (
                    <button
                      key={t.id}
                      className={`rooms-track-search-item ${form.initialTrackId === t.id ? "selected" : ""}`}
                      onClick={() => setForm(f => ({ ...f, initialTrackId: t.id, initialTrackSearch: t.title }))}
                    >
                      <span className="rooms-track-search-title">{t.title}</span>
                      <span className="rooms-track-search-artist">{t.primaryArtistName || ""}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setCreating(false)}>Hủy</button>
              <button className="btn-primary" onClick={handleCreate} disabled={creatingSubmit || !form.name.trim()}>
                {creatingSubmit ? "Đang tạo..." : "Tạo phòng"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Room list */}
      {loading ? (
        <div className="rooms-loading">Đang tải...</div>
      ) : (
        <div className="rooms-grid">
          {(tab === "discover" ? rooms : myRooms).length === 0 ? (
            <div className="rooms-empty">
              {tab === "discover"
                ? "Chưa có phòng nào đang hoạt động. Hãy tạo phòng đầu tiên!"
                : "Bạn chưa có phòng nào."}
            </div>
          ) : (
            (tab === "discover" ? rooms : myRooms).map(room => (
              <RoomCard
                key={room.id}
                room={room}
                onJoin={() => onOpenRoom(room.id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function RoomCard({ room, onJoin }) {
  return (
    <div className="room-card" onClick={onJoin}>
      <div className="room-card-header">
        <span className={`room-privacy-badge ${room.privacy}`}>
          {room.privacy === "private" ? "🔒" : "🌍"}
        </span>
        <span className="room-participant-count">
          👥 {room.participantCount || 0}
        </span>
      </div>
      <h3 className="room-card-name">{room.name}</h3>
      <p className="room-card-host">Tạo bởi {room.hostUsername}</p>
      {room.trackTitle && (
        <div className="room-card-now-playing">
          ♫ {room.trackTitle}
          {room.trackArtist ? ` — ${room.trackArtist}` : ""}
        </div>
      )}
      <button className="btn-primary room-card-join" onClick={e => { e.stopPropagation(); onJoin(); }}>
        Tham gia
      </button>
    </div>
  );
}
