import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { api, assetSrcFor } from "../../api.js";
import { SkeletonRows } from "../components/Skeleton.jsx";
import Pill from "../components/Pill.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import { timeAgo } from "../../lib/format.js";

const TABS = [
  { key: "", label: "Cần xử lý" },
  { key: "pending_review", label: "Chờ duyệt" },
  { key: "under_review", label: "Đang xem xét" },
  { key: "changes_requested", label: "Yêu cầu sửa" },
  { key: "approved", label: "Đã duyệt (chờ phát hành)" },
  { key: "published", label: "Đã phát hành" },
  { key: "rejected", label: "Đã từ chối" },
  { key: "all", label: "Tất cả" },
];

export default function SubmissionQueue() {
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState(null);

  useEffect(() => {
    setRows(null);
    const handle = setTimeout(() => {
      api.admin.submissionQueue(status, q).then((res) => setRows(res.submissions)).catch(() => setRows([]));
    }, q ? 250 : 0);
    return () => clearTimeout(handle);
  }, [status, q]);

  return (
    <div>
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Bài gửi</h1>
          <p className="admin-page-sub">Hàng đợi xét duyệt bài hát gửi lên từ nghệ sĩ.</p>
        </div>
      </div>

      <div className="admin-filter-row">
        {TABS.map((t) => (
          <button key={t.key} className={"admin-filter-tab" + (status === t.key ? " active" : "")} onClick={() => setStatus(t.key)}>
            {t.label}
          </button>
        ))}
        <div className="admin-search-box" style={{ marginLeft: "auto" }}>
          <Search size={15} />
          <input placeholder="Tìm theo tên bài hoặc nghệ sĩ..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-body" style={{ paddingTop: "var(--sp-3)" }}>
          {rows === null ? (
            <SkeletonRows count={6} />
          ) : rows.length === 0 ? (
            <EmptyState title="Không có bài gửi nào ở trạng thái này" subtitle="Hàng đợi trống — quay lại kiểm tra sau." />
          ) : (
            <div className="admin-row-list">
              {rows.map((s) => (
                <Link to={"/admin/submissions/" + s.id} className="admin-row" key={s.id}>
                  <div className="admin-row-art" style={{ backgroundImage: s.coverUrl ? `url(${assetSrcFor(s.coverUrl)})` : undefined, backgroundColor: "var(--glass-bg)" }} />
                  <div className="admin-row-main">
                    <div className="admin-row-title">{s.title}</div>
                    <div className="admin-row-sub">{s.artistName} · gửi {timeAgo(s.submittedAt || s.createdAt)}</div>
                  </div>
                  <div className="admin-row-meta">
                    <Pill status={s.status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
