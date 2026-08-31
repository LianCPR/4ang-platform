import { useState, useEffect } from "react";
import { Plus, Check, ListMusic } from "lucide-react";
import { api } from "../api";

export default function AddToPlaylistSheet({ trackId, onClose, showToast }) {
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [addingTo, setAddingTo] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.myPlaylists().then((res) => {
      if (!cancelled) setPlaylists(res.playlists || []);
    }).catch(() => {}).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  async function addToPlaylist(playlistId) {
    if (!trackId || addingTo) return;
    setAddingTo(playlistId);
    try {
      await api.addToPlaylist(playlistId, trackId);
      showToast && showToast("Đã thêm vào playlist.");
      onClose && onClose();
    } catch (e) {
      showToast && showToast(e.message);
    }
    setAddingTo(null);
  }

  async function createAndAdd() {
    if (!newName.trim() || creating) return;
    setCreating(true);
    try {
      const res = await api.createPlaylist({ title: newName.trim(), isPublic: true });
      await api.addToPlaylist(res.playlist.id, trackId);
      showToast && showToast("Đã tạo playlist và thêm bài.");
      onClose && onClose();
    } catch (e) {
      showToast && showToast(e.message);
    }
    setCreating(false);
  }

  return (
    <div>
      <h3 className="sheet-title">Thêm vào playlist</h3>

      {loading ? (
        <p className="sub" style={{ padding: "var(--sp-4) 0" }}>Đang tải...</p>
      ) : (
        <div className="atp-list">
          {playlists.map((p) => (
            <button key={p.id} type="button" className="atp-item glass-interactive" onClick={() => addToPlaylist(p.id)} disabled={addingTo === p.id}>
              <div className="atp-item-art" style={p.coverUrl ? { backgroundImage: "url('" + p.coverUrl + "')" } : {}}>
                {!p.coverUrl && <ListMusic size={16} />}
              </div>
              <div className="atp-item-info">
                <div className="atp-item-title">{p.title}</div>
                <div className="atp-item-meta">{p.trackCount} bài</div>
              </div>
              {addingTo === p.id && <span className="busy-dot" />}
            </button>
          ))}
        </div>
      )}

      <div className="atp-create">
        {creating ? (
          <div className="atp-create-input-row">
            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Tên playlist mới..." maxLength={100}
              onKeyDown={(e) => { if (e.key === "Enter") createAndAdd(); }} autoFocus />
            <button type="button" className="btn-primary btn-sm" onClick={createAndAdd} disabled={!newName.trim()}>Tạo</button>
          </div>
        ) : (
          <button type="button" className="link-btn" onClick={() => setCreating(true)}>
            <Plus size={14} /> Tạo playlist mới
          </button>
        )}
      </div>
    </div>
  );
}
