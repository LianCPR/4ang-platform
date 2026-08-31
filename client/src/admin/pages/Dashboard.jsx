import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Inbox, BadgeCheck, Users, Music2, Flag, TrendingUp } from "lucide-react";
import { api } from "../../api.js";
import { useAdminStats } from "../AdminStatsContext.jsx";
import StatCard from "../components/StatCard.jsx";
import { SkeletonBlock } from "../components/Skeleton.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import { timeAgo } from "../../lib/format.js";

const ACTION_LABELS = {
  reviewed: "bắt đầu xem xét", approved: "duyệt", rejected: "từ chối", changes_requested: "yêu cầu chỉnh sửa",
  published: "phát hành", user_restricted: "hạn chế tài khoản", user_restored: "gỡ hạn chế tài khoản",
  artist_verified: "xác minh nghệ sĩ", artist_verification_rejected: "từ chối xác minh",
  track_unpublished: "gỡ bài hát", track_republished: "phát hành lại bài hát", track_metadata_edited: "sửa thông tin bài hát",
  report_resolved: "xử lý báo cáo", report_dismissed: "bỏ qua báo cáo",
  submissions_paused: "tạm dừng nhận bài gửi", submissions_resumed: "mở lại nhận bài gửi",
};

export default function Dashboard() {
  const { stats, refreshStats } = useAdminStats();
  const [activity, setActivity] = useState(null);

  useEffect(() => {
    refreshStats();
    api.admin.activity(20).then((res) => setActivity(res.activity)).catch(() => setActivity([]));
  }, []);

  return (
    <div>
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Dashboard</h1>
          <p className="admin-page-sub">Tổng quan hoạt động nền tảng 4ANG theo thời gian thực.</p>
        </div>
      </div>

      {!stats ? (
        <div className="admin-stat-grid">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonBlock key={i} height={92} />)}
        </div>
      ) : (
        <div className="admin-stat-grid">
          <StatCard icon={Inbox} label="Chờ duyệt" value={stats.submissions.pendingReview} tone={stats.submissions.pendingReview > 0 ? "warning" : undefined} />
          <StatCard icon={Inbox} label="Đang xem xét" value={stats.submissions.underReview} tone="accent" />
          <StatCard icon={Inbox} label="Yêu cầu chỉnh sửa" value={stats.submissions.changesRequested} />
          <StatCard icon={Music2} label="Chờ phát hành" value={stats.submissions.approvedAwaitingPublish} tone="success" />
          <StatCard icon={TrendingUp} label="Duyệt hôm nay" value={stats.submissions.approvedToday} />
          <StatCard icon={Music2} label="Bài đã phát hành" value={stats.music.published} />
          <StatCard icon={Users} label="Tổng người dùng" value={stats.users.total} hint={stats.users.newToday > 0 ? `+${stats.users.newToday} hôm nay` : undefined} />
          <StatCard icon={BadgeCheck} label="Chờ xác minh" value={stats.artists.verificationPending} tone={stats.artists.verificationPending > 0 ? "warning" : undefined} />
          <StatCard icon={Users} label="Nghệ sĩ đã xác minh" value={stats.artists.verified} tone="accent" />
          <StatCard icon={Flag} label="Báo cáo đang mở" value={stats.reports.open} tone={stats.reports.open > 0 ? "danger" : undefined} />
          <StatCard icon={Users} label="Tài khoản bị hạn chế" value={stats.users.restricted} tone={stats.users.restricted > 0 ? "danger" : undefined} />
          <StatCard icon={TrendingUp} label="Tổng lượt nghe" value={stats.music.totalPlays.toLocaleString("vi-VN")} />
        </div>
      )}

      <div className="admin-card">
        <div className="admin-card-head">
          <h2>Hoạt động kiểm duyệt gần đây</h2>
          <Link to="/admin/audit-log" className="link-btn">Xem nhật ký đầy đủ</Link>
        </div>
        <div className="admin-card-body">
          {activity === null ? (
            <SkeletonBlock height={200} />
          ) : activity.length === 0 ? (
            <EmptyState title="Chưa có hoạt động kiểm duyệt nào" subtitle="Các hành động duyệt bài, xác minh nghệ sĩ, quản lý tài khoản sẽ hiện ở đây." />
          ) : (
            <div className="admin-feed">
              {activity.map((a) => (
                <div className="admin-feed-item" key={a.id}>
                  <span className="admin-feed-dot" />
                  <div>
                    <div className="admin-feed-text">
                      <strong>{a.actorUsername}</strong> đã {ACTION_LABELS[a.action] || a.action}
                      {a.targetLabel ? <> — "{a.targetLabel}"</> : a.targetId ? <> — {a.targetId}</> : null}
                    </div>
                    <div className="admin-feed-time">{timeAgo(a.createdAt)}</div>
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
