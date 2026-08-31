import { motion } from "framer-motion";
import { Home, Compass, Search, Library, User, Bell } from "lucide-react";

const TABS = [
  { id: "home", icon: Home, label: "Trang chủ" },
  { id: "discover", icon: Compass, label: "Khám phá" },
  { id: "search", icon: Search, label: "Tìm kiếm" },
  { id: "library", icon: Library, label: "Thư viện" },
  { id: "notifications", icon: Bell, label: "Thông báo" },
  { id: "profile", icon: User, label: "Hồ sơ" },
];

export default function BottomNav({ active, onChange, unreadNotifCount }) {
  return (
    <nav className="tabbar glass-strong" aria-label="Điều hướng chính">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            className={"tabbtn" + (isActive ? " active" : "")}
            onClick={() => onChange(tab.id)}
            aria-label={tab.label}
            aria-current={isActive ? "page" : undefined}
          >
            {isActive && (
              <motion.span
                className="tab-pill"
                layoutId="tab-pill"
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
              />
            )}
            <motion.span
              className="tab-icon"
              animate={isActive ? { scale: 1.1, y: -1 } : { scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 22 }}
            >
              <Icon size={20} strokeWidth={isActive ? 2.3 : 1.8} />
            </motion.span>
          </button>
        );
      })}
    </nav>
  );
}
