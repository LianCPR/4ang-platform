import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck, Ban, RotateCcw } from "lucide-react";
import { api } from "../../api.js";
import Pill from "../components/Pill.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import { SkeletonBlock } from "../components/Skeleton.jsx";
import { formatTimestamp } from "../lib/adminFormat.js";

export default function UserDetail({ showToast }) {
  const { username } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState(null);

  function load() {
    api.admin.user(username).then(setData).catch((e) => setError(e.message));
  }
  useEffect(() => { load(); }, [username]);

  if (error) return <div className="admin-status-page"><p className="admin-status-sub">{error}</p></div>;
  if (!data) return <SkeletonBlock height={300} />;

  const { user, artist, publishedTrackCount } = data;

  async function restrict(reason) {
    await api.admin.restrictUser(username, reason);
    showToast(`Đã hạn chế tài khoản @${username}.`);
    load();
  }
  async function restore() {
    await api.admin.restoreUser(username);
    showToast(`Đã gỡ hạn chế tài khoản @${username}.`);
    load();
  }

  return (
    <div>
      <Link to="/admin/users" className="link-btn" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: "var(--sp-4)" }}>
        <ArrowLeft size={14} /> Về danh sách người dùng
      </Link>

      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">{user.displayName}</h1>
          <p className="admin-page-sub">@{user.username}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {user.isAdmin && <Pill tone="accent"><ShieldCheck size={12} /> Admin</Pill>}
          {user.isRestricted && <Pill tone="danger">Đang bị hạn chế</Pill>}
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-head"><h2>Thông tin tài khoản</h2></div>
        <div className="admin-card-body">
          <dl className="admin-kv">
            <div className="admin-kv-row"><dt>Tên đăng nhập</dt><dd>@{user.username}</dd></div>
            <div className="admin-kv-row"><dt>Email</dt><dd>{user.email || "—"}</dd></div>
            <div className="admin-kv-row"><dt>Ngày tham gia</dt><dd>{formatTimestamp(user.createdAt)}</dd></div>
            <div className="admin-kv-row"><dt>Vai trò nghệ sĩ</dt><dd>{user.isArtist ? (user.artistBadge === "verified" ? "Verified Artist" : "Independent Artist") : "Không phải nghệ sĩ"}</dd></div>
            {artist && <div className="admin-kv-row"><dt>Bài hát đã phát hành</dt><dd>{publishedTrackCount}</dd></div>}
            {user.isRestricted && (
              <>
                <div className="admin-kv-row"><dt>Bị hạn chế lúc</dt><dd>{formatTimestamp(user.restrictedAt)}</dd></div>
                <div className="admin-kv-row"><dt>Lý do</dt><dd>{user.restrictedReason || "—"}</dd></div>
              </>
            )}
          </dl>
        </div>
      </div>

      {artist && (
        <div className="admin-card">
          <div className="admin-card-head">
            <h2>Hồ sơ nghệ sĩ</h2>
            <Link to={"/admin/artists/" + username} className="link-btn">Xem chi tiết nghệ sĩ</Link>
          </div>
        </div>
      )}

      <div className="admin-review-actions">
        {user.isAdmin ? (
          <p className="admin-status-sub">Không thể hạn chế tài khoản Admin.</p>
        ) : user.isRestricted ? (
          <button className="btn-primary" onClick={restore}><RotateCcw size={16} /> Gỡ hạn chế</button>
        ) : (
          <button className="btn-secondary btn-danger" onClick={() => setDialog(true)}><Ban size={16} /> Hạn chế tài khoản</button>
        )}
      </div>

      {dialog && (
        <ConfirmDialog title={`Hạn chế tài khoản @${username}?`} confirmLabel="Hạn chế" danger requireNote
          description="Tài khoản sẽ không thể thích, lưu, bình luận, theo dõi hay gửi bài — nhưng vẫn có thể duyệt nghe."
          notePlaceholder="Lý do hạn chế..."
          onConfirm={restrict}
          onClose={() => setDialog(false)} />
      )}
    </div>
  );
}
