import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, BadgeCheck } from "lucide-react";
import { api, assetSrcFor } from "../../api.js";
import { useAdminStats } from "../AdminStatsContext.jsx";
import Pill from "../components/Pill.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import { SkeletonBlock } from "../components/Skeleton.jsx";

export default function ArtistDetail({ showToast }) {
  const { username } = useParams();
  const { refreshStats } = useAdminStats();
  const [artist, setArtist] = useState(null);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState(false);

  function load() {
    api.artistProfile(username).then((res) => setArtist(res.artist)).catch((e) => setError(e.message));
  }
  useEffect(() => { load(); }, [username]);

  if (error) return <div className="admin-status-page"><p className="admin-status-sub">{error}</p></div>;
  if (!artist) return <SkeletonBlock height={300} />;

  async function verify() {
    await api.admin.verifyArtist(username);
    showToast(`Đã xác minh nghệ sĩ ${artist.artistName}.`);
    load(); refreshStats();
  }
  async function reject(note) {
    await api.admin.rejectArtistVerification(username, note);
    showToast(`Đã từ chối yêu cầu xác minh.`);
    load(); refreshStats();
  }

  return (
    <div>
      <Link to="/admin/artists" className="link-btn" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: "var(--sp-4)" }}>
        <ArrowLeft size={14} /> Về danh sách nghệ sĩ
      </Link>

      <div className="admin-page-head">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div className="avatar avatar-lg" style={{ backgroundImage: artist.avatarUrl ? `url(${assetSrcFor(artist.avatarUrl)})` : undefined }} />
          <div>
            <h1 className="admin-page-title">{artist.artistName}</h1>
            <p className="admin-page-sub">@{artist.username}</p>
          </div>
        </div>
        <Pill status={artist.verificationStatus} />
      </div>

      <div className="admin-stat-grid" style={{ marginBottom: "var(--sp-5)" }}>
        <div className="admin-stat-card"><div className="admin-stat-card-value">{artist.followers ?? 0}</div><div className="admin-stat-card-label">Người theo dõi</div></div>
        <div className="admin-stat-card"><div className="admin-stat-card-value">{artist.monthlyListeners ?? 0}</div><div className="admin-stat-card-label">Nghe hàng tháng</div></div>
        <div className="admin-stat-card"><div className="admin-stat-card-value">{(artist.tracks && artist.tracks.length) ?? 0}</div><div className="admin-stat-card-label">Bài đã phát hành</div></div>
      </div>

      <div className="admin-card">
        <div className="admin-card-head"><h2>Tiểu sử</h2></div>
        <div className="admin-card-body">
          <p className="admin-status-sub" style={{ textAlign: "left" }}>{artist.bio || "Chưa có tiểu sử."}</p>
        </div>
      </div>

      {artist.genres && artist.genres.length > 0 && (
        <div className="admin-genre-row" style={{ marginBottom: "var(--sp-5)" }}>
          {artist.genres.map((g) => <Pill key={g}>{g}</Pill>)}
        </div>
      )}

      {artist.verificationNote && (
        <div className="admin-card">
          <div className="admin-card-head"><h2>Ghi chú xác minh gần nhất</h2></div>
          <div className="admin-card-body"><p className="admin-status-sub" style={{ textAlign: "left" }}>{artist.verificationNote}</p></div>
        </div>
      )}

      <div className="admin-review-actions">
        {artist.verificationStatus !== "verified" && (
          <button className="btn-primary" onClick={verify}><BadgeCheck size={16} /> Xác minh nghệ sĩ</button>
        )}
        {artist.verificationStatus === "pending" && (
          <button className="btn-secondary btn-danger" onClick={() => setDialog(true)}>Từ chối yêu cầu</button>
        )}
      </div>

      {dialog && (
        <ConfirmDialog title="Từ chối yêu cầu xác minh?" confirmLabel="Từ chối" danger requireNote
          notePlaceholder="Lý do từ chối..."
          onConfirm={reject}
          onClose={() => setDialog(false)} />
      )}
    </div>
  );
}
