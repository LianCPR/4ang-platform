import { useState } from "react";
import { ShieldCheck } from "lucide-react";

export default function AdminLogin({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password) { setError("Nhập đầy đủ Admin ID và mật khẩu."); return; }
    setBusy(true);
    try {
      await onLogin(username.trim(), password);
    } catch (err) {
      setError(err.message || "Đăng nhập thất bại.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-login-wrap">
      <form className="admin-login-card glass-strong" onSubmit={submit}>
        <div className="admin-login-brand">
          <ShieldCheck size={26} className="c-accent" />
        </div>
        <div className="admin-login-tag">4ANG Admin Platform</div>
        <div className="admin-login-title">Đăng nhập Admin</div>
        <div className="admin-login-sub">Khu vực quản trị riêng biệt — chỉ dành cho tài khoản Admin.</div>

        <div className="field">
          <label htmlFor="admin-username">Admin ID</label>
          <input id="admin-username" autoFocus autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="admin_id" />
        </div>
        <div className="field">
          <label htmlFor="admin-password">Mật khẩu</label>
          <input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </div>

        {error && <p className="auth-error">{error}</p>}

        <button className="btn-primary btn-block" type="submit" disabled={busy}>
          {busy ? "Đang đăng nhập..." : "Đăng nhập"}
        </button>
      </form>
    </div>
  );
}
