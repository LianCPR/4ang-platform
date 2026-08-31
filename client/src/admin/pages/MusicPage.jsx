import { useEffect, useState } from "react";
import { Search, EyeOff, RotateCcw } from "lucide-react";
import { api, assetSrcFor } from "../../api.js";
import Pill from "../components/Pill.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import { SkeletonRows } from "../components/Skeleton.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import { formatCount } from "../../lib/format.js";

const TABS = [
  { key: "approved", label: "Đang phát hành" },
  { key: "unpublished", label: "Đã gỡ" },
  { key: "", label: "Tất cả" },
];

export default function MusicPage({ showToast }) {
  const [status, setStatus] = useState("approved");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState(null);
  const [dialogTrack, setDialogTrack] = useState(null); // { track, mode: 'unpublish' | 'edit' }

  function load() {
    setRows(null);
    api.admin.tracks({ status, q }).then((res) => setRows(res.tracks)).catch(() => setRows([]));
  }
  useEffect(() => {
    const handle = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(handle);
  }, [status, q]);

  async function unpublish(track, reason) {
    await api.admin.unpublishTrack(track.id, reason);
    showToast(`Đã gỡ "${track.title}" khỏi 4ANG.`);
    load();
  }
  async function republish(track) {
    await api.admin.republishTrack(track.id);
    showToast(`Đã phát hành lại "${track.title}".`);
    load();
  }

  return (
    <div>
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Âm nhạc</h1>
          <p className="admin-page-sub">Quản lý bài hát đã phát hành trên 4ANG.</p>
        </div>
      </div>

      <div className="admin-filter-row">
        {TABS.map((t) => (
          <button key={t.key || "all"} className={"admin-filter-tab" + (status === t.key ? " active" : "")} onClick={() => setStatus(t.key)}>{t.label}</button>
        ))}
        <div className="admin-search-box" style={{ marginLeft: "auto" }}>
          <Search size={15} />
          <input placeholder="Tìm theo tên bài, nghệ sĩ..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-body" style={{ paddingTop: "var(--sp-3)" }}>
          {rows === null ? <SkeletonRows count={8} /> : rows.length === 0 ? (
            <EmptyState title="Không có bài hát nào" />
          ) : (
            <div className="admin-row-list">
              {rows.map((t) => (
                <div className="admin-row" key={t.id} style={{ cursor: "default" }}>
                  <div className="admin-row-art" style={{ backgroundImage: t.coverUrl ? `url(${assetSrcFor(t.coverUrl)})` : undefined, backgroundColor: "var(--glass-bg)" }} />
                  <div className="admin-row-main">
                    <div className="admin-row-title">{t.title}</div>
                    <div className="admin-row-sub">{t.primaryArtistName || t.uploaderDisplayName} · {formatCount(t.playCount)} lượt nghe</div>
                  </div>
                  <div className="admin-row-meta"><Pill status={t.status === "approved" ? "published" : t.status} /></div>
                  <div className="admin-row-actions">
                    {t.status === "approved" ? (
                      <button className="btn-secondary btn-danger btn-sm" onClick={() => setDialogTrack(t)}><EyeOff size={13} /> Gỡ</button>
                    ) : t.status === "unpublished" ? (
                      <button className="btn-secondary btn-sm" onClick={() => republish(t)}><RotateCcw size={13} /> Phát hành lại</button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {dialogTrack && (
        <ConfirmDialog title={`Gỡ "${dialogTrack.title}" khỏi 4ANG?`} confirmLabel="Gỡ bài hát" danger
          description="Bài hát sẽ biến mất khỏi Trang chủ, Tìm kiếm và hồ sơ nghệ sĩ ngay lập tức. Có thể phát hành lại bất cứ lúc nào."
          notePlaceholder="Lý do gỡ (tuỳ chọn)"
          onConfirm={(reason) => unpublish(dialogTrack, reason)}
          onClose={() => setDialogTrack(null)} />
      )}
    </div>
  );
}
