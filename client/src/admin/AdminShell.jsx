import { NavLink, useNavigate } from "react-router-dom";
import {
  ShieldCheck, LayoutDashboard, Inbox, BadgeCheck, Users, Mic2, Music,
  Flag, BarChart3, ScrollText, Settings, LogOut, ArrowLeft, LifeBuoy,
} from "lucide-react";
import { useAdminStats } from "./AdminStatsContext.jsx";

const NAV_ITEMS = [
  { to: "/admin", end: true, icon: LayoutDashboard, label: "Dashboard" },
  { to: "/admin/submissions", icon: Inbox, label: "Bài gửi", badgeKey: "submissionQueue" },
  { to: "/admin/verifications", icon: BadgeCheck, label: "Xác minh nghệ sĩ", badgeKey: "verificationPending" },
  { to: "/admin/users", icon: Users, label: "Người dùng" },
  { to: "/admin/artists", icon: Mic2, label: "Nghệ sĩ" },
  { to: "/admin/music", icon: Music, label: "Âm nhạc" },
  { to: "/admin/reports", icon: Flag, label: "Báo cáo", badgeKey: "reportsOpen" },
  { to: "/admin/support", icon: LifeBuoy, label: "Hỗ trợ" },
  { to: "/admin/analytics", icon: BarChart3, label: "Phân tích" },
  { to: "/admin/audit-log", icon: ScrollText, label: "Nhật ký" },
  { to: "/admin/settings", icon: Settings, label: "Cài đặt" },
];

const MOBILE_ITEMS = NAV_ITEMS.filter((i) => ["/admin", "/admin/submissions", "/admin/verifications", "/admin/reports", "/admin/settings"].includes(i.to));

function badgeValue(stats, key) {
  if (!stats) return 0;
  if (key === "submissionQueue") return stats.submissions.pendingReview + stats.submissions.underReview;
  if (key === "verificationPending") return stats.artists.verificationPending;
  if (key === "reportsOpen") return stats.reports.open;
  return 0;
}

export default function AdminShell({ session, onLogout, children }) {
  const { stats } = useAdminStats();
  const navigate = useNavigate();

  return (
    <div className="admin-shell">
      <nav className="admin-nav">
        <div className="admin-nav-brand">
          <ShieldCheck size={20} className="c-accent" />
          <span className="admin-nav-brand-name">4ANG</span>
          <span className="admin-nav-brand-tag">Admin</span>
        </div>

        <div className="admin-nav-group-label">Quản trị</div>
        {NAV_ITEMS.map((item) => {
          const badge = item.badgeKey ? badgeValue(stats, item.badgeKey) : 0;
          return (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => "admin-nav-item" + (isActive ? " active" : "")}>
              <item.icon size={17} />
              <span>{item.label}</span>
              {badge > 0 && <span className="admin-nav-item-badge">{badge}</span>}
            </NavLink>
          );
        })}

        <div className="admin-nav-footer">
          <div className="admin-nav-user">
            <ShieldCheck size={14} />
            <span>{session.displayName || session.username}</span>
          </div>
          <a href="/" className="admin-nav-exit"><ArrowLeft size={16} /><span>Về 4ANG</span></a>
          <button className="admin-nav-exit" onClick={onLogout}><LogOut size={16} /><span>Đăng xuất</span></button>
        </div>
      </nav>

      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar-mobile-brand">
            <ShieldCheck size={18} className="c-accent" />
            <span className="admin-nav-brand-name" style={{ fontSize: "var(--fs-sm)" }}>4ANG Admin</span>
          </div>
          <div className="admin-nav-user" style={{ marginLeft: "auto" }}>
            <span>{session.displayName || session.username}</span>
          </div>
        </header>

        <main className="admin-content">{children}</main>
      </div>

      <nav className="admin-mobile-tabbar">
        {MOBILE_ITEMS.map((item) => {
          const badge = item.badgeKey ? badgeValue(stats, item.badgeKey) : 0;
          return (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => "admin-mobile-tab" + (isActive ? " active" : "")}>
              <item.icon size={19} />
              <span>{item.label}</span>
              {badge > 0 && <span className="admin-nav-item-badge" style={{ position: "absolute", marginLeft: 14, marginTop: -14 }}>{badge}</span>}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
