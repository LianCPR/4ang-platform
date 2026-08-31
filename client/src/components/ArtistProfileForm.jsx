import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, X } from "lucide-react";
import { GENRES } from "../lib/genres";

export default function ArtistProfileForm({ mode, initial, onSubmit, onCancel }) {
  const [artistName, setArtistName] = useState(initial?.artistName || "");
  const [bio, setBio] = useState(initial?.bio || "");
  const [genres, setGenres] = useState(initial?.genres || []);
  const [links, setLinks] = useState(initial?.links && initial.links.length ? initial.links : [{ label: "", url: "" }]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function toggleGenre(g) {
    setGenres((gs) => (gs.includes(g) ? gs.filter((x) => x !== g) : gs.length >= 5 ? gs : [...gs, g]));
  }
  function updateLink(i, field, value) {
    setLinks((ls) => ls.map((l, idx) => (idx === i ? { ...l, [field]: value } : l)));
  }
  function addLink() { setLinks((ls) => (ls.length >= 5 ? ls : [...ls, { label: "", url: "" }])); }
  function removeLink(i) { setLinks((ls) => ls.filter((_, idx) => idx !== i)); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!artistName.trim()) { setError("Cần tên nghệ sĩ."); return; }
    const cleanLinks = links.filter((l) => l.label.trim() || l.url.trim());
    for (const l of cleanLinks) {
      if (!l.label.trim() || !/^https?:\/\/.+/.test(l.url.trim())) {
        setError("Mỗi liên kết cần tên và URL hợp lệ (bắt đầu bằng http:// hoặc https://).");
        return;
      }
    }
    setBusy(true);
    try {
      await onSubmit({ artistName: artistName.trim(), bio: bio.trim(), genres, links: cleanLinks });
    } catch (err) {
      setError(err.message || "Có lỗi xảy ra, thử lại nhé.");
    }
    setBusy(false);
  }

  return (
    <form onSubmit={handleSubmit}>
      {mode === "create" && (
        <p className="sub" style={{ marginBottom: "var(--sp-4)" }}>
          Trở thành nghệ sĩ để có hồ sơ riêng, số liệu thật, và (sắp tới) gửi bài để 4ANG duyệt.
          Bạn sẽ nhận huy hiệu <strong>Nghệ sĩ độc lập</strong> (xanh lá) ngay — huy hiệu{" "}
          <strong>Đã xác minh bởi 4ANG</strong> (xanh dương) chỉ cấp sau khi được duyệt riêng.
        </p>
      )}

      <div className="field">
        <label>Tên nghệ sĩ</label>
        <input value={artistName} onChange={(e) => setArtistName(e.target.value)} placeholder="Tên bạn muốn hiển thị" maxLength={60} />
      </div>

      <div className="field">
        <label>Giới thiệu</label>
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Vài dòng về bạn và âm nhạc của bạn" rows={4} maxLength={1000} />
      </div>

      <div className="field">
        <label>Thể loại (tối đa 5)</label>
        <div className="genre-chip-row">
          {GENRES.map((g) => (
            <button type="button" key={g} className={"genre-chip" + (genres.includes(g) ? " active" : "")} onClick={() => toggleGenre(g)}>
              {g}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label>Liên kết</label>
        {links.map((l, i) => (
          <div className="link-row" key={i}>
            <input value={l.label} onChange={(e) => updateLink(i, "label", e.target.value)} placeholder="Tên (VD: Instagram)" maxLength={30} />
            <input value={l.url} onChange={(e) => updateLink(i, "url", e.target.value)} placeholder="https://..." />
            <button type="button" className="icon-btn" onClick={() => removeLink(i)} aria-label="Xoá liên kết"><X size={15} /></button>
          </div>
        ))}
        {links.length < 5 && (
          <button type="button" className="link-btn" onClick={addLink}><Plus size={14} /> Thêm liên kết</button>
        )}
      </div>

      {error && <motion.div className="auth-error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{error}</motion.div>}

      <div className="form-actions">
        {onCancel && <button type="button" className="btn-secondary" onClick={onCancel}>Hủy</button>}
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? <span className="btn-busy"><span className="busy-dot" /> Đang lưu...</span> : mode === "create" ? "Trở thành nghệ sĩ" : "Lưu thay đổi"}
        </button>
      </div>
    </form>
  );
}
