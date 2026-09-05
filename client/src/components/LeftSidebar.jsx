import { motion } from "framer-motion";
import { Home, Compass, Music, Users, Library, Radio, Heart, Clock, ListMusic, Disc3, Play, ShieldCheck, BarChart3 } from "lucide-react";
import { gradientFor, hashHue, initials } from "../lib/format";
import { Flower, Vine } from "../assets/Botanical";

const NAV_ITEMS = [
  { id: "home", icon: Home, label: "Home" },
  { id: "explore", icon: Compass, label: "Explore" },
  { id: "discover", icon: Music, label: "Discover" },
  { id: "social", icon: Users, label: "Social" },
  { id: "listening-stats", icon: BarChart3, label: "Listening Stats" },
];

const LIBRARY_ITEMS = [
  { id: "library", icon: Heart, label: "Liked Songs" },
  { id: "library", icon: Clock, label: "Recently Played" },
  { id: "library", icon: ListMusic, label: "Your Playlists" },
  { id: "library", icon: Disc3, label: "Albums" },
  { id: "library", icon: Users, label: "Artists You Follow" },
];

export default function LeftSidebar({ active, onChange, session, onOpenSettings, onOpenSupport }) {
  return (
    <aside className="left-sidebar">
      <nav className="sidebar-nav">
        <div className="sidebar-section">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const target = item.route || item.id;
            const isActive = active === target || active === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={"sidebar-item" + (isActive ? " active" : "")}
                onClick={() => onChange(target)}
              >
                {isActive && (
                  <motion.span
                    className="sidebar-pill"
                    layoutId="sidebar-pill"
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  />
                )}
                <Icon size={16} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {session?.isAdmin && (
          <>
            <div className="sidebar-divider" />
            <div className="sidebar-section">
              <p className="sidebar-section-title">ADMIN</p>
              <button type="button" className="sidebar-item" onClick={() => { window.location.href = "/admin"; }}>
                <ShieldCheck size={16} />
                <span>Dashboard</span>
              </button>
            </div>
          </>
        )}

        <div className="sidebar-divider" />

        <div className="sidebar-section">
          <p className="sidebar-section-title">YOUR LIBRARY</p>
          {LIBRARY_ITEMS.map((item, i) => {
            const Icon = item.icon;
            return (
              <button
                key={i}
                type="button"
                className="sidebar-item"
                onClick={() => onChange(item.id)}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <div className="sidebar-decoration">
        <Flower size={24} style={{ opacity: 0.15, color: "var(--c-sage)" }} />
      </div>
    </aside>
  );
}
