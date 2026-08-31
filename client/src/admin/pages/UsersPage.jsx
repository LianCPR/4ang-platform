import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, ShieldCheck, Ban } from "lucide-react";
import { api } from "../../api.js";
import { SkeletonRows } from "../components/Skeleton.jsx";
import Pill from "../components/Pill.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import { initials, gradientFor, hashHue } from "../../lib/format.js";

export default function UsersPage() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState(null);

  useEffect(() => {
    setRows(null);
    const handle = setTimeout(() => {
      api.admin.users(q).then((res) => setRows(res.users)).catch(() => setRows([]));
    }, q ? 250 : 0);
    return () => clearTimeout(handle);
  }, [q]);

  return (
    <div>
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Người dùng</h1>
          <p className="admin-page-sub">Tìm kiếm và quản lý tài khoản trên 4ANG.</p>
        </div>
        <div className="admin-search-box">
          <Search size={15} />
          <input placeholder="Tìm theo tên đăng nhập, tên hiển thị..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-body" style={{ paddingTop: "var(--sp-3)" }}>
          {rows === null ? <SkeletonRows count={8} /> : rows.length === 0 ? (
            <EmptyState title="Không tìm thấy người dùng nào" />
          ) : (
            <div className="admin-row-list">
              {rows.map((u) => (
                <Link to={"/admin/users/" + u.username} className="admin-row" key={u.username}>
                  <div className="admin-row-art avatar" style={{ background: gradientFor(hashHue(u.username)), display: "flex", alignItems: "center", justifyContent: "center", color: "var(--c1)", fontWeight: 700 }}>
                    {initials(u.displayName)}
                  </div>
                  <div className="admin-row-main">
                    <div className="admin-row-title">
                      {u.displayName}
                      {u.isAdmin && <Pill tone="accent"><ShieldCheck size={11} /> Admin</Pill>}
                      {u.isArtist && <Pill tone={u.artistBadge === "verified" ? "accent" : "success"}>{u.artistBadge === "verified" ? "Verified" : "Independent"}</Pill>}
                      {u.isRestricted && <Pill tone="danger"><Ban size={11} /> Hạn chế</Pill>}
                    </div>
                    <div className="admin-row-sub">@{u.username}{u.email ? ` · ${u.email}` : ""}</div>
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
