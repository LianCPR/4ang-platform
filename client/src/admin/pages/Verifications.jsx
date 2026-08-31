import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck } from "lucide-react";
import { api, assetSrcFor } from "../../api.js";
import { useAdminStats } from "../AdminStatsContext.jsx";
import Pill from "../components/Pill.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import { SkeletonRows } from "../components/Skeleton.jsx";
import EmptyState from "../../components/EmptyState.jsx";

const TABS = [
  { key: "pending", label: "Đang chờ" },
  { key: "verified", label: "Đã xác minh" },
  { key: "rejected", label: "Đã từ chối" },
  { key: "all", label: "Tất cả" },
];

export default function Verifications({ showToast }) {
  const { refreshStats } = useAdminStats();
  const [status, setStatus] = useState("pending");
  const [rows, setRows] = useState(null);
  const [dialogFor, setDialogFor] = useState(null);
  const [busyUser, setBusyUser] = useState(null);

  function load() {
    setRows(null);
    api.admin.verifications(status).then((res) => setRows(res.artists)).catch(() => setRows([]));
  }
  useEffect(() => { load(); }, [status]);

  async function verify(username) {
    setBusyUser(username);
    try {
      await api.admin.verifyArtist(username);
      showToast(`Đã xác minh nghệ sĩ ${username}. Huy hiệu chuyển sang xanh dương (Verified).`);
      load(); refreshStats();
    } catch (e) { showToast(e.message); }
    finally { setBusyUser(null); }
  }

  async function reject(username, note) {
    await api.admin.rejectArtistVerification(username, note);
    showToast(`Đã từ chối yêu cầu xác minh của ${username}.`);
    load(); refreshStats();
  }

  return (
    <div>
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Xác minh nghệ sĩ</h1>
          <p className="admin-page-sub">Chỉ Admin có thể cấp huy hiệu 4ANG Verified Artist (xanh dương). Nghệ sĩ không thể tự xác minh.</p>
        </div>
      </div>

      <div className="admin-filter-row">
        {TABS.map((t) => (
          <button key={t.key} className={"admin-filter-tab" + (status === t.key ? " active" : "")} onClick={() => setStatus(t.key)}>{t.label}</button>
        ))}
      </div>

      <div className="admin-card">
        <div className="admin-card-body" style={{ paddingTop: "var(--sp-3)" }}>
          {rows === null ? <SkeletonRows count={5} /> : rows.length === 0 ? (
            <EmptyState title="Không có yêu cầu nào" subtitle="Danh sách trống ở bộ lọc này." />
          ) : (
            <div className="admin-row-list">
              {rows.map((a) => (
                <div className="admin-row" key={a.username} style={{ cursor: "default" }}>
                  <Link to={"/admin/artists/" + a.username} className="admin-row-art" style={{ backgroundImage: a.avatarUrl ? `url(${assetSrcFor(a.avatarUrl)})` : undefined, backgroundColor: "var(--glass-bg)" }} />
                  <div className="admin-row-main">
                    <Link to={"/admin/artists/" + a.username} className="admin-row-title">{a.artistName}</Link>
                    <div className="admin-row-sub">@{a.username}{a.verificationNote ? ` · "${a.verificationNote}"` : ""}</div>
                  </div>
                  <div className="admin-row-meta"><Pill status={a.verificationStatus} /></div>
                  {a.verificationStatus === "pending" && (
                    <div className="admin-row-actions">
                      <button className="btn-primary btn-sm" disabled={busyUser === a.username} onClick={() => verify(a.username)}>
                        <BadgeCheck size={14} /> Xác minh
                      </button>
                      <button className="btn-secondary btn-danger btn-sm" disabled={busyUser === a.username} onClick={() => setDialogFor(a.username)}>Từ chối</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {dialogFor && (
        <ConfirmDialog title={`Từ chối xác minh cho @${dialogFor}?`} confirmLabel="Từ chối" danger requireNote
          notePlaceholder="Lý do từ chối (sẽ hiển thị cho nghệ sĩ)..."
          onConfirm={(note) => reject(dialogFor, note)}
          onClose={() => setDialogFor(null)} />
      )}
    </div>
  );
}
