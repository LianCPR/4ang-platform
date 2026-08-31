import { useEffect, useState } from "react";
import { SkeletonRows } from "../components/Skeleton.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import { api } from "../../api.js";
import { timeAgo } from "../../lib/format.js";
import { formatTimestamp } from "../lib/adminFormat.js";

const ACTION_LABELS = {
  submission_reviewed: "bắt đầu xem xét bài gửi", submission_approved: "duyệt bài gửi", submission_rejected: "từ chối bài gửi",
  submission_changes_requested: "yêu cầu chỉnh sửa bài gửi", submission_published: "phát hành bài hát",
  user_restricted: "hạn chế tài khoản", user_restored: "gỡ hạn chế tài khoản",
  artist_verified: "xác minh nghệ sĩ", artist_verification_rejected: "từ chối xác minh nghệ sĩ",
  track_unpublished: "gỡ bài hát", track_republished: "phát hành lại bài hát", track_metadata_edited: "sửa thông tin bài hát",
  report_resolved: "xử lý báo cáo", report_dismissed: "bỏ qua báo cáo",
  submissions_paused: "tạm dừng nhận bài gửi mới", submissions_resumed: "mở lại nhận bài gửi",
};

export default function AuditLogPage() {
  const [rows, setRows] = useState(null);

  useEffect(() => { api.admin.auditLog(200).then((res) => setRows(res.entries)).catch(() => setRows([])); }, []);

  return (
    <div>
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Nhật ký kiểm duyệt</h1>
          <p className="admin-page-sub">Toàn bộ hành động quan trọng của Admin — không thể chỉnh sửa hoặc xoá.</p>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-body" style={{ paddingTop: "var(--sp-3)" }}>
          {rows === null ? <SkeletonRows count={10} withArt={false} /> : rows.length === 0 ? (
            <EmptyState title="Chưa có mục nhật ký nào" />
          ) : (
            <div className="admin-feed">
              {rows.map((e) => (
                <div className="admin-feed-item" key={e.id}>
                  <span className="admin-feed-dot" />
                  <div>
                    <div className="admin-feed-text">
                      <strong>{e.actorUsername}</strong> {ACTION_LABELS[e.action] || e.action}
                      {e.targetId ? <> — <code>{e.targetType}:{e.targetId}</code></> : null}
                    </div>
                    <div className="admin-feed-time">{formatTimestamp(e.createdAt)} · {timeAgo(e.createdAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
