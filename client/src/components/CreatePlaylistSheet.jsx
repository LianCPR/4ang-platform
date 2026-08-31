import { useState, useRef } from "react";
import { X, ListMusic, Globe, Lock, Upload } from "lucide-react";
import { api } from "../api";

export default function CreatePlaylistSheet({ onClose, onCreated, showToast }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const coverInputRef = useRef(null);

  function handleCoverChange(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  }

  async function handleCreate() {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      const res = await api.createPlaylist({ title: title.trim(), description: description.trim(), isPublic });
      // Upload cover if selected
      if (coverFile && res.playlist) {
        try { await api.uploadPlaylistCover(res.playlist.id, coverFile); } catch (e) { /* cover optional */ }
      }
      showToast && showToast("Đã tạo playlist.");
      onCreated && onCreated(res.playlist);
      onClose && onClose();
    } catch (e) {
      showToast && showToast(e.message);
    }
    setSaving(false);
  }

  return (
    <div className="cps-sheet">
      <div className="cps-header">
        <h3 className="cps-title">Tạo playlist mới</h3>
        <button type="button" className="icon-btn" onClick={onClose}><X size={18} /></button>
      </div>

      <div className="cps-body">
        {/* Cover */}
        <div className="cps-cover-section">
          <div className="cps-cover-preview" onClick={() => coverInputRef.current?.click()}>
            {coverPreview ? (
              <img src={coverPreview} alt="Cover" />
            ) : (
              <div className="cps-cover-placeholder">
                <Upload size={20} />
                <span>Chọn ảnh bìa</span>
              </div>
            )}
          </div>
          <input ref={coverInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleCoverChange} />
        </div>

        {/* Form */}
        <div className="cps-field">
          <label>Tên playlist</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tên playlist..." maxLength={100} autoFocus />
        </div>

        <div className="cps-field">
          <label>Mô tả (tùy chọn)</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={500} placeholder="Thêm mô tả..." />
        </div>

        <div className="cps-field">
          <label>Quyền riêng tư</label>
          <div className="cps-visibility">
            <button type="button" className={"cps-vis-btn" + (isPublic ? " active" : "")} onClick={() => setIsPublic(true)}>
              <Globe size={14} /> Công khai
            </button>
            <button type="button" className={"cps-vis-btn" + (!isPublic ? " active" : "")} onClick={() => setIsPublic(false)}>
              <Lock size={14} /> Riêng tư
            </button>
          </div>
        </div>
      </div>

      <div className="cps-footer">
        <button type="button" className="btn-secondary btn-sm" onClick={onClose}>Huỷ</button>
        <button type="button" className="btn-primary btn-sm" onClick={handleCreate} disabled={!title.trim() || saving}>
          {saving ? "Đang tạo..." : "Tạo playlist"}
        </button>
      </div>
    </div>
  );
}
