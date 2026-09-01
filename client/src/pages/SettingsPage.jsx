import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Moon, Sun, Volume2, Music, Globe, Eye, EyeOff, Bell, Download, Trash2, Sparkles } from "lucide-react";
import { lsGet, lsSet } from "../storage";

const LANGUAGES = [
  { code: "vi", label: "Tiếng Việt" },
  { code: "en", label: "English" },
];

function Toggle({ checked, onChange }) {
  return (
    <button type="button" className={"settings-toggle" + (checked ? " on" : "")} onClick={() => onChange(!checked)}>
      <span className="settings-toggle-thumb" />
    </button>
  );
}

function SettingsSection({ title, children }) {
  return (
    <div className="settings-section">
      <h3 className="settings-section-title">{title}</h3>
      {children}
    </div>
  );
}

function SettingsRow({ label, desc, children }) {
  return (
    <div className="settings-row">
      <div className="settings-row-info">
        <span className="settings-row-label">{label}</span>
        {desc && <span className="settings-row-desc">{desc}</span>}
      </div>
      <div className="settings-row-control">{children}</div>
    </div>
  );
}

export default function SettingsPage({ session, showToast, onBack, onOpenOnboarding }) {
  const [darkMode, setDarkMode] = useState(() => document.documentElement.getAttribute("data-theme") === "dark");
  const [explicitContent, setExplicitContent] = useState(() => lsGet("settings_explicit", true));
  const [autoplay, setAutoplay] = useState(() => lsGet("settings_autoplay", true));
  const [showNowPlaying, setShowNowPlaying] = useState(() => lsGet("settings_show_np", true));
  const [notifications, setNotifications] = useState(() => lsGet("settings_notifications", true));
  const [language, setLanguage] = useState(() => lsGet("settings_language", "vi"));

  useEffect(() => { lsSet("settings_explicit", explicitContent); }, [explicitContent]);
  useEffect(() => { lsSet("settings_autoplay", autoplay); }, [autoplay]);
  useEffect(() => { lsSet("settings_show_np", showNowPlaying); }, [showNowPlaying]);
  useEffect(() => { lsSet("settings_notifications", notifications); }, [notifications]);
  useEffect(() => { lsSet("settings_language", language); }, [language]);

  function toggleDark() {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
    lsSet("theme", next ? "dark" : "light");
  }

  return (
    <div className="settings-page">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <div className="settings-header">
          <button type="button" className="link-btn" onClick={onBack}>
            <ArrowLeft size={16} /> Quay lại
          </button>
          <h1 className="settings-title">Cài đặt</h1>
        </div>

        {/* Appearance */}
        <SettingsSection title="Giao diện">
          <SettingsRow label="Chế độ tối" desc="Chuyển đổi giữa giao diện sáng và tối">
            <div className="settings-icon-row">
              {darkMode ? <Moon size={16} /> : <Sun size={16} />}
              <Toggle checked={darkMode} onChange={toggleDark} />
            </div>
          </SettingsRow>
          <SettingsRow label="Ngôn ngữ" desc="Thay đổi ngôn ngữ hiển thị">
            <select className="settings-select" value={language} onChange={(e) => setLanguage(e.target.value)}>
              {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </SettingsRow>
        </SettingsSection>

        {/* Playback */}
        <SettingsSection title="Phát nhạc">
          <SettingsRow label="Tự động phát" desc="Khi bài hát kết thúc, hệ thống tự phát bài tiếp theo">
            <Toggle checked={autoplay} onChange={setAutoplay} />
          </SettingsRow>
          <SettingsRow label="Nội dung rõ ràng" desc="Cho phép phát nội dung có gắn nhãn E">
            <Toggle checked={explicitContent} onChange={setExplicitContent} />
          </SettingsRow>
        </SettingsSection>

        {/* Display */}
        <SettingsSection title="Hiển thị">
          <SettingsRow label="Hiện panel Now Playing khi phát" desc="Mở panel chi tiết khi bắt đầu phát nhạc">
            <Toggle checked={showNowPlaying} onChange={setShowNowPlaying} />
          </SettingsRow>
          <SettingsRow label="Thông báo" desc="Hiển thị thông báo khi có bài mới hoặc cập nhật">
            <Toggle checked={notifications} onChange={setNotifications} />
          </SettingsRow>
        </SettingsSection>

        {/* Account */}
        <SettingsSection title="Tài khoản">
          <SettingsRow label="Email" desc={session?.email || "—"} />
          <SettingsRow label="Tên người dùng" desc={session?.username || "—"} />
          <SettingsRow label="Vai trò" desc={session?.isAdmin ? "Admin" : session?.isArtist ? "Nghệ sĩ" : "Người dùng"} />
        </SettingsSection>

        {/* Personalization */}
        {onOpenOnboarding && (
          <SettingsSection title="Cá nhân hóa">
            <SettingsRow label="Thiết lập sở thích" desc="Chọn thể loại và nghệ sĩ yêu thích để 4ANG gợi ý nhạc phù hợp">
              <button type="button" className="settings-action-btn" onClick={onOpenOnboarding}>
                <Sparkles size={14} /> Thiết lập
              </button>
            </SettingsRow>
          </SettingsSection>
        )}

        {/* Danger Zone */}
        <SettingsSection title="Nguy hiểm">
          <SettingsRow label="Xoá dữ liệu nghe cục bộ" desc="Xoá lịch sử nghe và tuỳ chọn đã lưu trên trình duyệt này">
            <button type="button" className="btn-danger-sm" onClick={() => {
              localStorage.clear();
              showToast("Đã xoá dữ liệu cục bộ.");
            }}>
              <Trash2 size={14} /> Xoá
            </button>
          </SettingsRow>
        </SettingsSection>
      </motion.div>
    </div>
  );
}
