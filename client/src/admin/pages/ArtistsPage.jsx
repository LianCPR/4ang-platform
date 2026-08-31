import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { api, assetSrcFor } from "../../api.js";
import Pill from "../components/Pill.jsx";
import { SkeletonRows } from "../components/Skeleton.jsx";
import EmptyState from "../../components/EmptyState.jsx";

const TABS = [
  { key: "all", label: "Tất cả" },
  { key: "verified", label: "Verified" },
  { key: "independent", label: "Independent" },
  { key: "pending", label: "Đang chờ xác minh" },
  { key: "rejected", label: "Đã từ chối xác minh" },
];

export default function ArtistsPage() {
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("all");

  useEffect(() => {
    // Reuses the same admin verification-listing endpoint (status=all) as
    // the Verifications page — one real backend query, two views onto it,
    // rather than a second bespoke "list artists" endpoint.
    api.admin.verifications("all").then((res) => setRows(res.artists)).catch(() => setRows([]));
  }, []);

  const filtered = useMemo(() => {
    if (!rows) return null;
    let list = rows;
    if (tab === "verified") list = list.filter((a) => a.verificationStatus === "verified");
    else if (tab === "pending") list = list.filter((a) => a.verificationStatus === "pending");
    else if (tab === "rejected") list = list.filter((a) => a.verificationStatus === "rejected");
    else if (tab === "independent") list = list.filter((a) => a.verificationStatus === "independent");
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      list = list.filter((a) => a.artistName.toLowerCase().includes(needle) || a.username.toLowerCase().includes(needle));
    }
    return list;
  }, [rows, tab, q]);

  return (
    <div>
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Nghệ sĩ</h1>
          <p className="admin-page-sub">Toàn bộ hồ sơ nghệ sĩ trên 4ANG.</p>
        </div>
      </div>

      <div className="admin-filter-row">
        {TABS.map((t) => (
          <button key={t.key} className={"admin-filter-tab" + (tab === t.key ? " active" : "")} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
        <div className="admin-search-box" style={{ marginLeft: "auto" }}>
          <Search size={15} />
          <input placeholder="Tìm nghệ sĩ..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-body" style={{ paddingTop: "var(--sp-3)" }}>
          {filtered === null ? <SkeletonRows count={8} /> : filtered.length === 0 ? (
            <EmptyState title="Không tìm thấy nghệ sĩ nào" />
          ) : (
            <div className="admin-row-list">
              {filtered.map((a) => (
                <Link to={"/admin/artists/" + a.username} className="admin-row" key={a.username}>
                  <div className="admin-row-art" style={{ backgroundImage: a.avatarUrl ? `url(${assetSrcFor(a.avatarUrl)})` : undefined, backgroundColor: "var(--glass-bg)" }} />
                  <div className="admin-row-main">
                    <div className="admin-row-title">{a.artistName}</div>
                    <div className="admin-row-sub">@{a.username}</div>
                  </div>
                  <div className="admin-row-meta"><Pill status={a.verificationStatus} /></div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
