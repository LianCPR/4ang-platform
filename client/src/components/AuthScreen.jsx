import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";
import { CornerOrnament, Flower, Butterfly } from "../assets/Botanical";
import SocialAuthButtons from "./SocialAuthButtons";

export default function AuthScreen({ mode, form, error, busy, onModeChange, onFieldChange, onSubmit, onOAuthSuccess, onOAuthError }) {
  const isSignup = mode === "signup";
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    setConfirmPassword("");
    setLocalError("");
    setShowPassword(false);
  }, [mode]);

  function handleSubmit(e) {
    if (isSignup) {
      if (!form.username.trim() || !form.password) {
        e.preventDefault();
        setLocalError("Điền đủ tên đăng nhập và mật khẩu nhé.");
        return;
      }
      if (form.password.length < 6) {
        e.preventDefault();
        setLocalError("Mật khẩu cần ít nhất 6 ký tự.");
        return;
      }
      if (form.password !== confirmPassword) {
        e.preventDefault();
        setLocalError("Mật khẩu nhập lại không khớp.");
        return;
      }
    }
    setLocalError("");
    onSubmit(e);
  }

  const shownError = localError || error;

  return (
    <div className="auth-wrap">
      {/* Decorative background elements */}
      <div className="atmosphere-glow" />

      <motion.div
        className="auth-card"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        style={{
          background: "var(--surface)",
          border: "1px solid var(--divider)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <CornerOrnament className="auth-corner auth-corner-tl" />
        <CornerOrnament className="auth-corner auth-corner-br" size={22} />

        {/* Decorative butterfly */}
        <motion.div
          style={{ position: "absolute", top: -8, right: 40, opacity: 0.3, color: "var(--c-rose)" }}
          animate={{ y: [0, -3, 0], rotate: [0, 2, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        >
          <Butterfly size={20} />
        </motion.div>

        <motion.div
          className="brand auth-brand"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <span className="brand-diamond brand-diamond-lg" />
          <span className="brand-name">4ANG</span>
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.p
            key={mode}
            className="auth-lede"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            {isSignup ? "Kể thêm một câu chuyện âm nhạc." : "Chào bạn trở lại."}
          </motion.p>
        </AnimatePresence>

        <div className="auth-toggle">
          <button type="button" className={mode === "login" ? "active" : ""} onClick={() => onModeChange("login")}>
            {mode === "login" && (
              <motion.span className="auth-toggle-pill" layoutId="auth-toggle-pill" transition={{ type: "spring", stiffness: 420, damping: 32 }} />
            )}
            <span className="auth-toggle-label">Đăng nhập</span>
          </button>
          <button type="button" className={mode === "signup" ? "active" : ""} onClick={() => onModeChange("signup")}>
            {mode === "signup" && (
              <motion.span className="auth-toggle-pill" layoutId="auth-toggle-pill" transition={{ type: "spring", stiffness: 420, damping: 32 }} />
            )}
            <span className="auth-toggle-label">Đăng ký</span>
          </button>
        </div>

        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.24 }}
        >
          <AnimatePresence initial={false}>
            {isSignup && (
              <motion.div
                className="field"
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: "auto", marginBottom: "var(--sp-4)" }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
                style={{ overflow: "hidden" }}
              >
                <label>Tên hiển thị</label>
                <input value={form.displayName} onChange={(e) => onFieldChange("displayName", e.target.value)} placeholder="Ví dụ: Damg" autoComplete="name" />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="field">
            <label>Tên đăng nhập</label>
            <input value={form.username} onChange={(e) => onFieldChange("username", e.target.value)} placeholder="ten_dang_nhap" autoComplete="username" />
          </div>

          <div className="field">
            <label>Mật khẩu</label>
            <div className="field-input-wrap">
              <input
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(e) => onFieldChange("password", e.target.value)}
                placeholder="ít nhất 6 ký tự"
                autoComplete={isSignup ? "new-password" : "current-password"}
              />
              <button type="button" className="field-icon-btn" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"} tabIndex={-1}>
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {isSignup && (
              <motion.div
                className="field"
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: "auto", marginBottom: "var(--sp-4)" }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
                style={{ overflow: "hidden" }}
              >
                <label>Nhập lại mật khẩu</label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="nhập lại mật khẩu"
                  autoComplete="new-password"
                />
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {shownError && (
              <motion.div
                className="auth-error"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                {shownError}
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button type="submit" className="btn-primary btn-block" disabled={busy} whileTap={{ scale: 0.98 }}>
            {busy ? (
              <span className="btn-busy"><span className="busy-dot" /> Đang xử lý...</span>
            ) : (
              isSignup ? "Tạo tài khoản" : "Đăng nhập"
            )}
          </motion.button>
        </motion.form>

        <SocialAuthButtons onSuccess={onOAuthSuccess} onError={onOAuthError} />

        <p className="auth-note">Tài khoản lưu thật trên server — mật khẩu được mã hoá, không lưu dạng thô.</p>
      </motion.div>
    </div>
  );
}
