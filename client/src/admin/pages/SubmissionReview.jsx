import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, PlayCircle, CheckCircle2, XCircle, MessageSquareWarning, UploadCloud } from "lucide-react";
import { api, assetSrcFor } from "../../api.js";
import { useAdminStats } from "../AdminStatsContext.jsx";
import Pill from "../components/Pill.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import { SkeletonBlock } from "../components/Skeleton.jsx";
import { creditRoleLabel } from "../../lib/submissions.js";
import { timeAgo, formatDate } from "../../lib/format.js";

const EVENT_LABELS = {
  submitted: "Gửi yêu cầu", resubmitted: "Gửi lại yêu cầu", reviewed: "Bắt đầu xem xét",
  approved: "Duyệt", rejected: "Từ chối", changes_requested: "Yêu cầu chỉnh sửa", published: "Phát hành",
};

export default function SubmissionReview({ showToast }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { refreshStats } = useAdminStats();
  const [sub, setSub] = useState(null);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState(null); // 'approve' | 'reject' | 'changes' | 'publish'
  const [busy, setBusy] = useState(false);

  function load() {
    api.admin.submission(id).then((res) => setSub(res.submission)).catch((e) => setError(e.message));
  }
  useEffect(() => { load(); }, [id]);

  async function act(fn, successMsg) {
    setBusy(true);
    try {
      await fn();
      showToast(successMsg);
      load();
      refreshStats();
    } catch (e) {
      showToast(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (error) return <div className="admin-status-page"><p className="admin-status-sub">{error}</p><Link to="/admin/submissions" className="btn-secondary">Về hàng đợi</Link></div>;
  if (!sub) return <SkeletonBlock height={400} />;

  const audioUrl = assetSrcFor(`/api/submissions/${sub.id}/audio`);
  const videoUrl = sub.hasVideo ? assetSrcFor(`/api/submissions/${sub.id}/video`) : null;

  return (
    <div>
      <Link to="/admin/submissions" className="link-btn" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: "var(--sp-4)" }}>
        <ArrowLeft size={14} /> Về hàng đợi bài gửi
      </Link>

      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">{sub.title}</h1>
          <p className="admin-page-sub">{sub.artistName} · gửi {timeAgo(sub.submittedAt || sub.createdAt)}</p>
        </div>
        <Pill status={sub.status} />
      </div>

      <div className="admin-review-grid">
        <div>
          <div className="admin-review-cover" style={{ backgroundImage: sub.coverUrl ? `url(${assetSrcFor(sub.coverUrl)})` : undefined, backgroundColor: "var(--glass-bg)" }} />

          <audio className="admin-media-audio" controls src={audioUrl} />
          {videoUrl && <video className="admin-media-video" controls src={videoUrl} />}

          <dl className="admin-kv">
            <div className="admin-kv-row"><dt>Nghệ sĩ gửi</dt><dd>{sub.artistName} {sub.artistBadge ? <Pill tone={sub.artistBadge === "verified" ? "accent" : "success"}>{sub.artistBadge === "verified" ? "Verified" : "Independent"}</Pill> : null}</dd></div>
            <div className="admin-kv-row"><dt>Loại phát hành</dt><dd>{sub.releaseType === "single" ? "Đĩa đơn" : sub.releaseType}</dd></div>
            <div className="admin-kv-row"><dt>Ngày phát hành</dt><dd>{sub.releaseDate ? formatDate(sub.releaseDate) : "—"}</dd></div>
            <div className="admin-kv-row"><dt>Ngôn ngữ</dt><dd>{sub.language || "—"}</dd></div>
            <div className="admin-kv-row"><dt>Nội dung nhạy cảm</dt><dd>{sub.isExplicit ? "Có" : "Không"}</dd></div>
            <div className="admin-kv-row"><dt>Xác nhận bản quyền</dt><dd>{sub.rightsConfirmed ? "Đã xác nhận" : "Chưa"}</dd></div>
            <div className="admin-kv-row"><dt>Điều khoản</dt><dd>{sub.termsAccepted ? `Đã chấp nhận (${sub.termsVersion || "?"})` : "Chưa chấp nhận"}</dd></div>
            <div className="admin-kv-row"><dt>File gốc</dt><dd>{sub.audioOriginalName || "—"}</dd></div>
          </dl>

          <div className="admin-genre-row">
            {sub.genres.map((g) => <Pill key={g} tone="default">{g}</Pill>)}
          </div>
        </div>

        <div>
          <div className="admin-card">
            <div className="admin-card-head"><h2>Ê-kíp & vai trò</h2></div>
            <div className="admin-card-body">
              {sub.credits.length === 0 ? <p className="admin-empty-inline">Không có thông tin ê-kíp.</p> : (
                <div className="admin-row-list">
                  {sub.credits.map((c) => (
                    <div className="admin-row" key={c.id} style={{ cursor: "default" }}>
                      <div className="admin-row-art" style={{ backgroundImage: c.avatarUrl ? `url(${assetSrcFor(c.avatarUrl)})` : undefined, backgroundColor: "var(--glass-bg)" }} />
                      <div className="admin-row-main">
                        <div className="admin-row-title">{c.artistName}{c.isPrimary && <Pill tone="accent">Chính</Pill>}</div>
                        <div className="admin-row-sub">{creditRoleLabel(c.role)}{c.isExternal ? " · chưa có tài khoản 4ANG" : ""}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="admin-card">
            <div className="admin-card-head"><h2>Lời bài hát</h2></div>
            <div className="admin-card-body">
              <p style={{ whiteSpace: "pre-wrap", fontSize: "var(--fs-sm)", color: "var(--text)" }}>{sub.lyrics || "Không có lời bài hát."}</p>
            </div>
          </div>

          {sub.adminNote && (
            <div className="admin-card">
              <div className="admin-card-head"><h2>Ghi chú gần nhất của Admin</h2></div>
              <div className="admin-card-body"><p className="admin-status-sub" style={{ textAlign: "left" }}>{sub.adminNote}</p></div>
            </div>
          )}

          <div className="admin-card">
            <div className="admin-card-head"><h2>Lịch sử xử lý</h2></div>
            <div className="admin-card-body">
              <ul className="submission-timeline">
                {sub.events.map((e) => (
                  <li key={e.id}>
                    <span className="submission-timeline-dot" />
                    <div>
                      <div><strong>{e.actorUsername}</strong> — {EVENT_LABELS[e.action] || e.action}</div>
                      {e.note && <div className="sub">"{e.note}"</div>}
                      <div className="admin-feed-time">{timeAgo(e.createdAt)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Review actions — every button here maps to a real, server-
              validated status transition (Part 39-43); nothing here just
              flips local state. */}
          <div className="admin-review-actions">
            {sub.status === "pending_review" && (
              <button className="btn-primary" disabled={busy} onClick={() => act(() => api.admin.reviewSubmission(sub.id), "Đã bắt đầu xem xét.")}>
                <PlayCircle size={16} /> Bắt đầu xem xét
              </button>
            )}
            {sub.status === "under_review" && (
              <>
                <button className="btn-primary" disabled={busy} onClick={() => setDialog("approve")}><CheckCircle2 size={16} /> Duyệt</button>
                <button className="btn-secondary" disabled={busy} onClick={() => setDialog("changes")}><MessageSquareWarning size={16} /> Yêu cầu chỉnh sửa</button>
                <button className="btn-secondary btn-danger" disabled={busy} onClick={() => setDialog("reject")}><XCircle size={16} /> Từ chối</button>
              </>
            )}
            {sub.status === "approved" && (
              <button className="btn-primary" disabled={busy} onClick={() => setDialog("publish")}><UploadCloud size={16} /> Phát hành bài hát</button>
            )}
            {sub.status === "published" && sub.publishedTrackId && (
              <span className="admin-status-sub">Đã phát hành — mã bài hát: {sub.publishedTrackId}</span>
            )}
          </div>
        </div>
      </div>

      {dialog === "approve" && (
        <ConfirmDialog title="Duyệt bài gửi này?" confirmLabel="Duyệt"
          description="Bài hát sẽ chuyển sang trạng thái đã duyệt, chờ được phát hành."
          notePlaceholder="Ghi chú nội bộ (tuỳ chọn)"
          onConfirm={(note) => act(() => api.admin.approveSubmission(sub.id, note), "Đã duyệt bài gửi.")}
          onClose={() => setDialog(null)} />
      )}
      {dialog === "changes" && (
        <ConfirmDialog title="Yêu cầu chỉnh sửa" confirmLabel="Gửi yêu cầu" requireNote
          description="Phản hồi này sẽ hiển thị cho nghệ sĩ để họ chỉnh sửa và gửi lại."
          notePlaceholder="Ví dụ: chất lượng âm thanh chưa đạt, cần cập nhật bìa đĩa..."
          onConfirm={(note) => act(() => api.admin.requestChanges(sub.id, note), "Đã gửi yêu cầu chỉnh sửa.")}
          onClose={() => setDialog(null)} />
      )}
      {dialog === "reject" && (
        <ConfirmDialog title="Từ chối bài gửi này?" confirmLabel="Từ chối" danger requireNote
          description="Lý do sẽ được lưu lại và hiển thị cho nghệ sĩ."
          notePlaceholder="Lý do từ chối..."
          onConfirm={(note) => act(() => api.admin.rejectSubmission(sub.id, note), "Đã từ chối bài gửi.")}
          onClose={() => setDialog(null)} />
      )}
      {dialog === "publish" && (
        <ConfirmDialog title="Phát hành bài hát này?" confirmLabel="Phát hành"
          description="Bài hát sẽ xuất hiện công khai trên 4ANG ngay lập tức — trên Trang chủ, Tìm kiếm, hồ sơ nghệ sĩ và có thể phát."
          onConfirm={() => act(() => api.admin.publishSubmission(sub.id), "Đã phát hành bài hát.")}
          onClose={() => setDialog(null)} />
      )}
    </div>
  );
}
