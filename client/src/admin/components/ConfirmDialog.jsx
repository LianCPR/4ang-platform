import { useState } from "react";

// A lightweight, purpose-built confirm modal (Part 39: "actions must have
// confirmation where appropriate") — separate from the public app's Sheet
// component since this needs a text-reason field for several call sites
// (restrict, reject, unpublish) and a plain OK/Cancel for others.
export default function ConfirmDialog({ title, description, confirmLabel = "Xác nhận", danger, requireNote, notePlaceholder, onConfirm, onClose }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleConfirm() {
    if (requireNote && !note.trim()) { setError("Cần nhập lý do."); return; }
    setBusy(true);
    setError("");
    try {
      await onConfirm(note.trim());
      onClose();
    } catch (e) {
      setError(e.message || "Có lỗi xảy ra.");
      setBusy(false);
    }
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="admin-login-card glass-strong" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <div className="admin-login-title" style={{ textAlign: "left" }}>{title}</div>
        {description && <p className="admin-status-sub" style={{ margin: "6px 0 var(--sp-4)", textAlign: "left" }}>{description}</p>}
        {(requireNote || notePlaceholder) && (
          <textarea
            className="admin-note-textarea"
            placeholder={notePlaceholder || "Ghi chú (tuỳ chọn)"}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            autoFocus
          />
        )}
        {error && <p className="admin-inline-error">{error}</p>}
        <div className="admin-confirm-actions">
          <button className="btn-secondary" onClick={onClose} disabled={busy}>Huỷ</button>
          <button className={danger ? "btn-secondary btn-danger" : "btn-primary"} onClick={handleConfirm} disabled={busy}>
            {busy ? "Đang xử lý..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
