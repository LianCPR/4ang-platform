import { useState, useEffect, useRef, useCallback } from "react";
import { Image, Plus, Trash2, GripVertical, ArrowUp, ArrowDown, Save, X, Upload, ExternalLink } from "lucide-react";
import { api } from "../../api.js";

/* ─── Banner Form (create / edit) ────────────────────── */
function BannerForm({ banner, onSave, onCancel, showToast }) {
  const [form, setForm] = useState({
    title: banner?.title || "",
    description: banner?.description || "",
    button_text: banner?.button_text || "PLAY",
    link_url: banner?.link_url || "",
    sort_order: banner?.sort_order || 0,
    is_active: banner?.is_active !== false,
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(banner?.image_url || "");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast("Ảnh phải nhỏ hơn 5MB.");
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) {
      showToast("Nhập tiêu đề banner.");
      return;
    }
    setSaving(true);
    try {
      let savedBanner;
      if (banner?.id) {
        // Update existing
        const res = await api.admin.updateBanner(banner.id, form);
        savedBanner = res.banner;
      } else {
        // Create new
        const res = await api.admin.createBanner(form);
        savedBanner = res.banner;
      }
      // Upload image if selected
      if (imageFile && savedBanner?.id) {
        await api.admin.uploadBannerImage(savedBanner.id, imageFile);
      }
      showToast(banner?.id ? "Đã cập nhật banner." : "Đã tạo banner.");
      onSave();
    } catch (e) {
      showToast(e.message || "Lỗi khi lưu banner.");
    }
    setSaving(false);
  }

  return (
    <div className="admin-card" style={{ marginBottom: "var(--sp-5)" }}>
      <div className="admin-card-head">
        <h2>{banner?.id ? "Chỉnh sửa banner" : "Tạo banner mới"}</h2>
        <button className="btn-secondary" onClick={onCancel} style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <X size={14} /> Hủy
        </button>
      </div>
      <div className="admin-card-body">
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
          {/* Image Upload */}
          <div>
            <label style={{ display: "block", fontSize: "var(--fs-xs)", color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Ảnh banner
            </label>
            <div
              style={{
                border: "2px dashed var(--divider)", borderRadius: "var(--r-card)", padding: "var(--sp-4)",
                textAlign: "center", cursor: "pointer", transition: "border-color 0.2s",
                background: imagePreview ? "none" : "var(--surface)",
                minHeight: 120, display: "flex", alignItems: "center", justifyContent: "center",
              }}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = "var(--accent)"; }}
              onDragLeave={(e) => { e.currentTarget.style.borderColor = "var(--divider)"; }}
              onDrop={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = "var(--divider)"; const f = e.dataTransfer.files?.[0]; if (f && f.type.startsWith("image/")) { setImageFile(f); setImagePreview(URL.createObjectURL(f)); } }}
            >
              {imagePreview ? (
                <div style={{ position: "relative", width: "100%" }}>
                  <img src={imagePreview} alt="Preview" style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: "var(--r-card)" }} />
                  <div style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.6)", borderRadius: "var(--r-pill)", padding: "4px 10px", fontSize: "var(--fs-xs)", color: "white" }}>
                    Nhấn để thay đổi
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, color: "var(--text-faint)" }}>
                  <Upload size={24} />
                  <span style={{ fontSize: "var(--fs-sm)" }}>Kéo thả ảnh hoặc nhấn để chọn</span>
                  <span style={{ fontSize: "var(--fs-xs)" }}>JPG, PNG • Tối đa 5MB • 1200×400px khuyến nghị</span>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />
          </div>

          {/* Title */}
          <div>
            <label style={{ display: "block", fontSize: "var(--fs-xs)", color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Tiêu đề *
            </label>
            <input
              type="text" value={form.title} maxLength={200} required
              placeholder="VD: SSD — Single mới ra mắt"
              style={{ width: "100%", padding: "10px 14px", background: "var(--surface)", border: "1px solid var(--divider)", borderRadius: "var(--r-btn)", color: "var(--text-bright)", fontSize: "var(--fs-sm)" }}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>

          {/* Description */}
          <div>
            <label style={{ display: "block", fontSize: "var(--fs-xs)", color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Mô tả
            </label>
            <textarea
              value={form.description} maxLength={500} rows={2}
              placeholder="Mô tả ngắn gọn..."
              style={{ width: "100%", padding: "10px 14px", background: "var(--surface)", border: "1px solid var(--divider)", borderRadius: "var(--r-btn)", color: "var(--text-bright)", fontSize: "var(--fs-sm)", resize: "vertical" }}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          {/* Button text + Link URL */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "var(--sp-3)" }}>
            <div>
              <label style={{ display: "block", fontSize: "var(--fs-xs)", color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Text nút bấm
              </label>
              <input
                type="text" value={form.button_text} maxLength={50}
                placeholder="PLAY"
                style={{ width: "100%", padding: "10px 14px", background: "var(--surface)", border: "1px solid var(--divider)", borderRadius: "var(--r-btn)", color: "var(--text-bright)", fontSize: "var(--fs-sm)" }}
                onChange={(e) => setForm({ ...form, button_text: e.target.value })}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "var(--fs-xs)", color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Đường link
              </label>
              <input
                type="text" value={form.link_url} maxLength={500}
                placeholder="VD: /artist/ten-nghe-si hoặc https://..."
                style={{ width: "100%", padding: "10px 14px", background: "var(--surface)", border: "1px solid var(--divider)", borderRadius: "var(--r-btn)", color: "var(--text-bright)", fontSize: "var(--fs-sm)" }}
                onChange={(e) => setForm({ ...form, link_url: e.target.value })}
              />
            </div>
          </div>

          {/* Sort order + Active toggle */}
          <div style={{ display: "flex", gap: "var(--sp-4)", alignItems: "center" }}>
            <div>
              <label style={{ display: "block", fontSize: "var(--fs-xs)", color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Thứ tự
              </label>
              <input
                type="number" value={form.sort_order}
                style={{ width: 80, padding: "10px 14px", background: "var(--surface)", border: "1px solid var(--divider)", borderRadius: "var(--r-btn)", color: "var(--text-bright)", fontSize: "var(--fs-sm)" }}
                onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "var(--fs-xs)", color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Hiển thị
              </label>
              <button
                type="button"
                className={"admin-switch" + (form.is_active ? " on" : "")}
                onClick={() => setForm({ ...form, is_active: !form.is_active })}
                aria-pressed={form.is_active}
              >
                <span className="admin-switch-knob" />
              </button>
            </div>
          </div>

          {/* Submit */}
          <div style={{ display: "flex", gap: "var(--sp-3)", justifyContent: "flex-end" }}>
            <button type="button" className="btn-secondary" onClick={onCancel}>Hủy</button>
            <button type="submit" className="btn-primary" disabled={saving} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Save size={14} />
              {saving ? "Đang lưu..." : (banner?.id ? "Cập nhật" : "Tạo banner")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Banner List Item ──────────────────────────────── */
function BannerItem({ banner, onEdit, onDelete, onMoveUp, onMoveDown, isFirst, isLast }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "var(--sp-3)",
      padding: "var(--sp-3)", border: "1px solid var(--divider)", borderRadius: "var(--r-card)",
      background: "var(--surface)", marginBottom: 8, opacity: banner.is_active ? 1 : 0.5,
    }}>
      {/* Drag / Order */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <button onClick={onMoveUp} disabled={isFirst} style={{ background: "none", border: "none", cursor: isFirst ? "default" : "pointer", color: "var(--text-faint)", padding: 2, opacity: isFirst ? 0.3 : 1 }}>
          <ArrowUp size={14} />
        </button>
        <button onClick={onMoveDown} disabled={isLast} style={{ background: "none", border: "none", cursor: isLast ? "default" : "pointer", color: "var(--text-faint)", padding: 2, opacity: isLast ? 0.3 : 1 }}>
          <ArrowDown size={14} />
        </button>
      </div>

      {/* Thumbnail */}
      <div style={{
        width: 120, height: 60, borderRadius: "var(--r-btn)", overflow: "hidden", flexShrink: 0,
        background: "var(--bg-muted)", display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {banner.image_url ? (
          <img src={banner.image_url} alt={banner.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <Image size={20} style={{ color: "var(--text-faint)" }} />
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "var(--fs-sm)", color: "var(--text-bright)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {banner.title || "(Không có tiêu đề)"}
        </div>
        <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-faint)", marginTop: 2 }}>
          {banner.description ? banner.description.slice(0, 60) + (banner.description.length > 60 ? "..." : "") : "Không có mô tả"}
          {banner.link_url && <span style={{ marginLeft: 8, color: "var(--accent)" }}>🔗 {banner.link_url.slice(0, 30)}</span>}
        </div>
      </div>

      {/* Status */}
      <span style={{
        fontSize: "var(--fs-xs)", padding: "3px 8px", borderRadius: "var(--r-pill)",
        background: banner.is_active ? "rgba(34,197,94,0.12)" : "rgba(156,163,175,0.12)",
        color: banner.is_active ? "#22c55e" : "var(--text-faint)",
      }}>
        {banner.is_active ? "Hiển thị" : "Ẩn"}
      </span>

      {/* Actions */}
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={onEdit} style={{ background: "none", border: "1px solid var(--divider)", borderRadius: "var(--r-btn)", padding: "6px 12px", cursor: "pointer", color: "var(--text-bright)", fontSize: "var(--fs-xs)" }}>
          Sửa
        </button>
        <button onClick={onDelete} style={{ background: "none", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "var(--r-btn)", padding: "6px 10px", cursor: "pointer", color: "#ef4444" }}>
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════ */
export default function BannersPage({ showToast }) {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null = not editing, {} = new, {id} = edit existing
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => { loadBanners(); }, []);

  async function loadBanners() {
    setLoading(true);
    try {
      const res = await api.admin.listBanners();
      setBanners(res.banners || []);
    } catch (e) {
      showToast("Không thể tải danh sách banner.");
    }
    setLoading(false);
  }

  async function handleDelete(id) {
    try {
      await api.admin.deleteBanner(id);
      showToast("Đã xóa banner.");
      setConfirmDelete(null);
      loadBanners();
    } catch (e) {
      showToast(e.message || "Không thể xóa banner.");
    }
  }

  async function handleMove(id, direction) {
    const idx = banners.findIndex((b) => b.id === id);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= banners.length) return;
    const newBanners = [...banners];
    [newBanners[idx].sort_order, newBanners[swapIdx].sort_order] = [newBanners[swapIdx].sort_order, newBanners[idx].sort_order];
    [newBanners[idx], newBanners[swapIdx]] = [newBanners[swapIdx], newBanners[idx]];
    setBanners(newBanners);
    // Persist sort order
    try {
      await Promise.all(newBanners.map((b, i) => api.admin.updateBanner(b.id, { sort_order: i })));
    } catch (e) {
      showToast("Không thể cập nhật thứ tự.");
      loadBanners();
    }
  }

  if (loading) {
    return (
      <div>
        <div className="admin-page-head">
          <h1 className="admin-page-title">Banner</h1>
        </div>
        <div style={{ padding: "var(--sp-8)", textAlign: "center", color: "var(--text-faint)" }}>Đang tải...</div>
      </div>
    );
  }

  // If editing, show form
  if (editing !== null) {
    return (
      <div>
        <div className="admin-page-head">
          <h1 className="admin-page-title">{editing.id ? "Chỉnh sửa banner" : "Tạo banner mới"}</h1>
        </div>
        <BannerForm
          banner={editing}
          onSave={() => { setEditing(null); loadBanners(); }}
          onCancel={() => setEditing(null)}
          showToast={showToast}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Banner</h1>
          <p className="admin-page-sub">Quản lý banner hiển thị trên trang chủ.</p>
        </div>
        <button className="btn-primary" onClick={() => setEditing({})} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Plus size={15} /> Tạo banner
        </button>
      </div>

      {banners.length === 0 ? (
        <div className="admin-card">
          <div className="admin-card-body" style={{ padding: "var(--sp-8)", textAlign: "center" }}>
            <Image size={40} style={{ color: "var(--text-faint)", opacity: 0.3, marginBottom: "var(--sp-3)" }} />
            <p style={{ color: "var(--text-muted)", marginBottom: "var(--sp-3)" }}>Chưa có banner nào.</p>
            <button className="btn-primary" onClick={() => setEditing({})} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Plus size={14} /> Tạo banner đầu tiên
            </button>
          </div>
        </div>
      ) : (
        <div>
          {banners.map((b, i) => (
            <BannerItem
              key={b.id}
              banner={b}
              onEdit={() => setEditing(b)}
              onDelete={() => setConfirmDelete(b)}
              onMoveUp={() => handleMove(b.id, "up")}
              onMoveDown={() => handleMove(b.id, "down")}
              isFirst={i === 0}
              isLast={i === banners.length - 1}
            />
          ))}
        </div>
      )}

      {/* Preview */}
      {banners.length > 0 && (
        <div style={{ marginTop: "var(--sp-5)" }}>
          <p style={{ fontSize: "var(--fs-xs)", color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "var(--sp-3)" }}>
            Preview — Banner đang hiển thị trên trang chủ
          </p>
          <div style={{ borderRadius: "var(--r-card)", overflow: "hidden", border: "1px solid var(--divider)", maxHeight: 220 }}>
            {banners.filter((b) => b.is_active && b.image_url).slice(0, 1).map((b) => (
              <div key={b.id} style={{ position: "relative", width: "100%", height: 220 }}>
                <img src={b.image_url} alt={b.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 60%)", display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "var(--sp-4)" }}>
                  <span style={{ fontSize: "var(--fs-2xs)", color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.1em" }}>FEATURED</span>
                  <span style={{ fontSize: "var(--fs-lg)", color: "white", fontFamily: "var(--font-serif)", fontWeight: 600 }}>{b.title}</span>
                  {b.description && <span style={{ fontSize: "var(--fs-sm)", color: "rgba(255,255,255,0.7)", marginTop: 2 }}>{b.description}</span>}
                  {b.button_text && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: "var(--sp-2)", background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)", borderRadius: "var(--r-pill)", padding: "6px 16px", fontSize: "var(--fs-xs)", color: "white", width: "fit-content", border: "1px solid rgba(255,255,255,0.2)" }}>
                      ▶ {b.button_text}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }} onClick={() => setConfirmDelete(null)}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--divider)", borderRadius: "var(--r-card)", padding: "var(--sp-5)", maxWidth: 400, width: "90%" }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: "var(--fs-md)", color: "var(--text-bright)", marginBottom: "var(--sp-3)" }}>Xóa banner?</h3>
            <p style={{ fontSize: "var(--fs-sm)", color: "var(--text-muted)", marginBottom: "var(--sp-4)" }}>
              Banner "{confirmDelete.title || "(Không có tiêu đề)"}" sẽ bị xóa vĩnh viễn.
            </p>
            <div style={{ display: "flex", gap: "var(--sp-3)", justifyContent: "flex-end" }}>
              <button className="btn-secondary" onClick={() => setConfirmDelete(null)}>Hủy</button>
              <button className="btn-primary" style={{ background: "#ef4444" }} onClick={() => handleDelete(confirmDelete.id)}>Xóa</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
