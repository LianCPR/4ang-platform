import { Bell } from "lucide-react";
import { gradientFor, hashHue, initials } from "../lib/format";
import { Flower } from "../assets/Botanical";

export default function TopBar({ session, onAvatarClick, unreadNotifCount, onNotifClick }) {
  const showBadge = unreadNotifCount > 0;
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-diamond" />
        <span className="brand-name">4ANG</span>
      </div>
      <div className="topbar-actions">
        <button type="button" className="icon-btn" onClick={onNotifClick} aria-label="Thông báo" style={{ position: "relative" }}>
          <Bell size={20} />
          {showBadge && <span className="topbar-badge">{unreadNotifCount > 99 ? "99+" : unreadNotifCount}</span>}
        </button>
        <button type="button" className="avatar" style={{ background: gradientFor(hashHue(session.displayName)) }} onClick={onAvatarClick} title={session.displayName}>
          {initials(session.displayName)}
        </button>
      </div>
    </header>
  );
}
