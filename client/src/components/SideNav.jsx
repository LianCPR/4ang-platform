import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Home, Compass, Music, Users, Library, Radio, UploadCloud, LogOut, Bell, Search, Sun, Moon } from "lucide-react";
import { gradientFor, hashHue, initials } from "../lib/format";

const NAV_ITEMS = [
  { id: "home", label: "HOME" },
  { id: "explore", label: "EXPLORE" },
  { id: "discover", label: "DISCOVER" },
  { id: "library", label: "LIBRARY" },
  { id: "listening-stats", label: "STATS" },
];

function useDarkMode() {
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem("4ang_theme") === "dark"; } catch { return false; }
  });
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    try { localStorage.setItem("4ang_theme", dark ? "dark" : "light"); } catch {}
  }, [dark]);
  return [dark, setDark];
}

export default function SideNav({ active, onChange, onUpload, session, onLogout, unreadNotifCount }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [darkMode, setDarkMode] = useDarkMode();

  function handleSearch(e) {
    e.preventDefault();
    if (searchQuery.trim()) {
      onChange("search");
    }
  }

  function handleNavClick(id) {
    onChange(id);
  }

  return (
    <nav className="topnav">
      <div className="topnav-inner">
        <div className="topnav-brand" onClick={() => onChange("home")} style={{ cursor: "pointer" }}>
          <span className="brand-diamond" />
          <span className="topnav-brand-text">4ANG</span>
          <span className="topnav-brand-sep">—</span>
          <span className="topnav-brand-sub">MUSIC PLATFORM</span>
        </div>

        <div className="topnav-links">
          {NAV_ITEMS.map((item) => {
            const isActive = active === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={"topnav-link" + (isActive ? " active" : "")}
                onClick={() => handleNavClick(item.id)}
              >
                {item.label}
                {isActive && (
                  <motion.span
                    className="topnav-link-underline"
                    layoutId="topnav-underline"
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="topnav-right">
          <form className="topnav-search" onSubmit={handleSearch}>
            <Search size={14} className="topnav-search-icon" />
            <input
              type="text"
              placeholder="Search songs, artists..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="topnav-search-input"
            />
          </form>

          <button type="button" className="topnav-upload-btn" onClick={onUpload} aria-label="Gửi bài hát">
            <UploadCloud size={14} />
            <span>Gửi bài</span>
          </button>

          <button type="button" className="icon-btn" onClick={() => onChange("notifications")} aria-label="Thông báo" style={{ position: "relative" }}>
            <Bell size={17} />
            {unreadNotifCount > 0 && <span className="topbar-badge">{unreadNotifCount > 99 ? "99+" : unreadNotifCount}</span>}
          </button>

          <button type="button" className="icon-btn" onClick={() => setDarkMode((d) => !d)} aria-label={darkMode ? "Chế độ sáng" : "Chế độ tối"} title={darkMode ? "Chế độ sáng" : "Chế độ tối"}>
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          <button type="button" className="topnav-user" onClick={() => onChange("profile")}>
            <span className="avatar avatar-sm" style={{ background: gradientFor(hashHue(session.displayName)) }}>
              {initials(session.displayName)}
            </span>
          </button>

          <button type="button" className="icon-btn" onClick={onLogout} title="Đăng xuất" style={{ opacity: 0.4 }}>
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </nav>
  );
}
