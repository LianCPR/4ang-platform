import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, UserPlus } from "lucide-react";
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
  const [busyItem, setBusyItem] = useState(null);

  function load() {
    setRows(null);
    api.admin.verifications(status).then((res) => setRows(res.artists)).catch(() => setRows([]));
  }
  useEffect(() => { load(); }, [status]);

  // Approve handler — dispatches to the correct endpoint based on _type
  async function approve(item) {
    const key = item._type + ":" + (item.id || item.username);
    setBusyItem(key);
    try {
      if (item._type === "application") {
        await api.admin.approveArtistApplication(item.id);
        showToast(`Đã duyệt đăng ký nghệ sĩ ${item.artistName || item.username}.`);
      } else {
        await api.admin.verifyArtist(item.username);
        showToast(`Đã xác minh nghệ sĩ ${item.username}. Huy hiệu chuyển sang xanh dương (Verified).`);
      }
      load(); refreshStats();
    } catch (e) { showToast(e.message); }
    finally { setBusyItem(null); }
  }

  // Reject handler
  async function reject(item, note) {
    const key = item._type + ":" + (item.id || item.username);
    setBusyItem(key);
    try {
      if (item._type === "application") {
        await api.admin.rejectArtistApplication(item.id, note);
        showToast(`Đã từ chối đăng ký của ${item.username}.`);
      } else {
        await api.admin.rejectArtistVerification(item.username, note);
        showToast(`Đã từ chối yêu cầu xác minh của ${item.username}.`);
      }
      load(); refreshStats();
    } catch (e) { showToast(e.message); }
    finally { setBusyItem(null); }
  }

  return (
    <div>
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Xác minh & Duyệt nghệ sĩ</h1>
          <p className="admin-page-sub">Duyệt đăng ký trở thành nghệ sĩ và cấp huy hiệu 4ANG Verified Artist. Nghệ sĩ không thể tự xác minh.</p>
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
              {rows.map((a) => {
                const isApplication = a._type === "application";
                const busyKey = a._type + ":" + (a.id || a.username);
                return (
                  <div className="admin-row" key={(isApplication ? "app-" : "prof-") + (a.id || a.username)} style={{ cursor: "default" }}>
                    <Link
                      to={isApplication ? "#" : "/admin/artists/" + a.username}
                      className="admin-row-art"
                      style={{
                        backgroundImage: a.avatarUrl ? `url(${assetSrcFor(a.avatarUrl)})` : undefined,
                        backgroundColor: "var(--glass-bg)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {isApplication && <UserPlus size={24} style={{ color: "var(--text-secondary)" }} />}
                    </Link>
                    <div className="admin-row-main">
                      <Link
                        to={isApplication ? "#" : "/admin/artists/" + a.username}
                        className="admin-row-title"
                        onClick={isApplication ? (e) => e.preventDefault() : undefined}
                      >
                        {a.artistName || a.username}
                      </Link>
                      <div className="admin-row-sub">
                        @{a.username}
                        {isApplication && <span style={{ marginLeft: 6, padding: "1px 6px", borderRadius: 4, background: "var(--accent-dim)", color: "var(--accent)", fontSize: "var(--fs-xs)", fontWeight: 600 }}>Đăng ký mới</span>}
                        {!isApplication && a.verificationNote && <span> · "{a.verificationNote}"</span>}
                        {isApplication && a.email && <span style={{ marginLeft: 6, color: "var(--text-tertiary)", fontSize: "var(--fs-xs)" }}>{a.email}</span>}
                        {isApplication && a.mainGenre && <span style={{ marginLeft: 6, color: "var(--text-tertiary)", fontSize: "var(--fs-xs)" }}>• {a.mainGenre}</span>}
                      </div>
                    </div>
                    <div className="admin-row-meta"><Pill status={a.verificationStatus} /></div>
                    {a.verificationStatus === "pending" && (
                      <div className="admin-row-actions">
                        <button className="btn-primary btn-sm" disabled={busyItem === busyKey} onClick={() => approve(a)}>
                          <BadgeCheck size={14} /> {isApplication ? "Duyệt" : "Xác minh"}
                        </button>
                        <button className="btn-secondary btn-danger btn-sm" disabled={busyItem === busyKey} onClick={() => setDialogFor(a)}>Từ chối</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {dialogFor && (
        <ConfirmDialog
          title={dialogFor._type === "application" ? `Từ chối đăng ký của @${dialogFor.username}?` : `Từ chối xác minh cho @${dialogFor.username}?`}
          confirmLabel="Từ chối" danger requireNote
          notePlaceholder="Lý do từ chối (sẽ hiển thị cho nghệ sĩ)..."
          onConfirm={(note) => reject(dialogFor, note)}
          onClose={() => setDialogFor(null)} />
      )}
    </div>
  );
}
