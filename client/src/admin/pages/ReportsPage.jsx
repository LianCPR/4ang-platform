import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Flag, Check, X } from "lucide-react";
import { api } from "../../api.js";
import { useAdminStats } from "../AdminStatsContext.jsx";
import Pill from "../components/Pill.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import { SkeletonRows } from "../components/Skeleton.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import { timeAgo } from "../../lib/format.js";

const TABS = [
  { key: "open", label: "Đang mở" },
  { key: "resolved", label: "Đã xử lý" },
  { key: "dismissed", label: "Đã bỏ qua" },
  { key: "all", label: "Tất cả" },
];

const REASON_LABELS = { copyright: "Bản quyền", metadata: "Sai thông tin", inappropriate: "Nội dung không phù hợp", spam: "Spam", other: "Khác" };
const TARGET_LABELS = { track: "Bài hát", artist: "Nghệ sĩ", comment: "Bình luận" };

export default function ReportsPage({ showToast }) {
  const { refreshStats } = useAdminStats();
  const [status, setStatus] = useState("open");
  const [rows, setRows] = useState(null);
  const [dialog, setDialog] = useState(null); // { report, outcome }

  function load() {
    setRows(null);
    api.admin.reports(status).then((res) => setRows(res.reports)).catch(() => setRows([]));
  }
  useEffect(() => { load(); }, [status]);

  async function resolve(report, outcome, note) {
    await api.admin.resolveReport(report.id, outcome, note);
    showToast(outcome === "dismissed" ? "Đã bỏ qua báo cáo." : "Đã xử lý báo cáo.");
    load(); refreshStats();
  }

  return (
    <div>
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Báo cáo</h1>
          <p className="admin-page-sub">Nội dung do người dùng báo cáo — bản quyền, spam, nội dung không phù hợp.</p>
        </div>
      </div>

      <div className="admin-filter-row">
        {TABS.map((t) => (
          <button key={t.key} className={"admin-filter-tab" + (status === t.key ? " active" : "")} onClick={() => setStatus(t.key)}>{t.label}</button>
        ))}
      </div>

      <div className="admin-card">
        <div className="admin-card-body" style={{ paddingTop: "var(--sp-3)" }}>
          {rows === null ? <SkeletonRows count={5} withArt={false} /> : rows.length === 0 ? (
            <EmptyState title="Không có báo cáo nào" subtitle="Khi người dùng báo cáo bài hát hoặc nghệ sĩ, chúng sẽ hiện ở đây." />
          ) : (
            <div className="admin-row-list">
              {rows.map((r) => (
                <div className="admin-row" key={r.id} style={{ cursor: "default" }}>
                  <Flag size={16} style={{ flexShrink: 0, color: "var(--text-faint)" }} />
                  <div className="admin-row-main">
                    <div className="admin-row-title">{TARGET_LABELS[r.targetType] || r.targetType} · {REASON_LABELS[r.reason] || r.reason}</div>
                    <div className="admin-row-sub">
                      Báo cáo bởi @{r.reporterUsername} · {timeAgo(r.createdAt)}
                      {r.note ? ` · "${r.note}"` : ""}
                      {r.resolutionNote ? ` · Ghi chú xử lý: "${r.resolutionNote}"` : ""}
                    </div>
                  </div>
                  <div className="admin-row-meta"><Pill status={r.status} /></div>
                  {r.status === "open" && (
                    <div className="admin-row-actions">
                      <button className="btn-primary btn-sm" onClick={() => setDialog({ report: r, outcome: "resolved" })}><Check size={13} /> Xử lý</button>
                      <button className="btn-secondary btn-sm" onClick={() => setDialog({ report: r, outcome: "dismissed" })}><X size={13} /> Bỏ qua</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {dialog && (
        <ConfirmDialog
          title={dialog.outcome === "dismissed" ? "Bỏ qua báo cáo này?" : "Đánh dấu báo cáo đã xử lý?"}
          confirmLabel={dialog.outcome === "dismissed" ? "Bỏ qua" : "Đã xử lý"}
          notePlaceholder="Ghi chú xử lý (tuỳ chọn)"
          onConfirm={(note) => resolve(dialog.report, dialog.outcome, note)}
          onClose={() => setDialog(null)} />
      )}
    </div>
  );
}
