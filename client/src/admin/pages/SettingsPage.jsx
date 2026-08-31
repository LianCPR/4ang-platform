import { useEffect, useState } from "react";
import { PauseCircle } from "lucide-react";
import { api } from "../../api.js";

// Only real, currently-enforced settings live here (Part 54/63) — the
// submissionsPaused toggle is actually read by server/src/routes/
// submissions.js on every POST /api/submissions?action=submit. No JWT
// secrets, storage keys, or DB credentials are ever surfaced here.
export default function SettingsPage({ showToast }) {
  const [settings, setSettings] = useState(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  function load() {
    api.admin.settings().then((res) => {
      setSettings(res.settings);
      setMessage(res.settings.submissionsPausedMessage || "");
    }).catch(() => {});
  }
  useEffect(() => { load(); }, []);

  async function toggle() {
    if (!settings) return;
    setBusy(true);
    try {
      const res = await api.admin.updateSettings({ submissionsPaused: !settings.submissionsPaused });
      setSettings(res.settings);
      showToast(res.settings.submissionsPaused ? "Đã tạm dừng nhận bài gửi mới." : "Đã mở lại nhận bài gửi mới.");
    } catch (e) { showToast(e.message); }
    finally { setBusy(false); }
  }

  async function saveMessage() {
    setBusy(true);
    try {
      const res = await api.admin.updateSettings({ submissionsPausedMessage: message });
      setSettings(res.settings);
      showToast("Đã lưu thông báo.");
    } catch (e) { showToast(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div>
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Cài đặt</h1>
          <p className="admin-page-sub">Cấu hình nền tảng — chỉ những thiết lập thực sự được áp dụng.</p>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-head"><h2><PauseCircle size={16} style={{ display: "inline", marginRight: 6, verticalAlign: -3 }} />Chính sách gửi bài</h2></div>
        <div className="admin-card-body">
          {!settings ? (
            <p className="admin-empty-inline">Đang tải...</p>
          ) : (
            <>
              <div className="admin-toggle-row">
                <div>
                  <div style={{ fontSize: "var(--fs-sm)", color: "var(--text-bright)", marginBottom: 2 }}>Tạm dừng nhận bài gửi mới</div>
                  <div className="sub">Khi bật, nghệ sĩ vẫn có thể lưu bản nháp nhưng không thể gửi để xét duyệt.</div>
                </div>
                <button className={"admin-switch" + (settings.submissionsPaused ? " on" : "")} onClick={toggle} disabled={busy} aria-pressed={settings.submissionsPaused}>
                  <span className="admin-switch-knob" />
                </button>
              </div>

              <div className="field" style={{ marginTop: "var(--sp-4)" }}>
                <label>Thông báo hiển thị cho nghệ sĩ khi tạm dừng</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="4ANG hiện tạm dừng nhận bài gửi mới. Vui lòng quay lại sau."
                />
              </div>
              <button className="btn-secondary" onClick={saveMessage} disabled={busy}>Lưu thông báo</button>
            </>
          )}
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-head"><h2>Phiên bản điều khoản gửi bài</h2></div>
        <div className="admin-card-body">
          <p className="admin-status-sub" style={{ textAlign: "left" }}>
            Mọi bài gửi hiện tại yêu cầu chấp nhận điều khoản phiên bản <strong>2026-08</strong>. Đây là giá trị cố định trong mã nguồn backend, không thể chỉnh sửa từ giao diện này.
          </p>
        </div>
      </div>
    </div>
  );
}
