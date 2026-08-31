import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Phone, ArrowLeft, Loader2, Shield } from "lucide-react";
import { CornerOrnament, Butterfly, Flower, Vine } from "../assets/Botanical";
import { api } from "../api";

// ─── OTP Input Component ─────────────────────────────────────────
function OTPInput({ length = 6, value, onChange, autoFocus = true, onComplete }) {
  const inputRefs = useRef([]);

  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [autoFocus]);

  function handleChange(index, val) {
    if (val.length > 1) {
      const digits = val.replace(/\D/g, "").slice(0, length).split("");
      const newValue = value.split("");
      digits.forEach((d, i) => {
        if (index + i < length) newValue[index + i] = d;
      });
      const next = newValue.join("").slice(0, length);
      onChange(next);
      const nextIndex = Math.min(index + digits.length, length - 1);
      inputRefs.current[nextIndex]?.focus();
      if (next.length === length && onComplete) setTimeout(() => onComplete(next), 150);
      return;
    }
    if (!/^\d*$/.test(val)) return;
    const newValue = value.split("");
    newValue[index] = val;
    const next = newValue.join("").slice(0, length);
    onChange(next);
    if (val && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
    if (next.length === length && onComplete) setTimeout(() => onComplete(next), 150);
  }

  function handleKeyDown(index, e) {
    if (e.key === "Backspace" && !value[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      const newValue = value.split("");
      newValue[index - 1] = "";
      onChange(newValue.join(""));
    }
  }

  function handlePaste(e) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (pasted) {
      onChange(pasted);
      const nextIndex = Math.min(pasted.length, length - 1);
      inputRefs.current[nextIndex]?.focus();
      if (pasted.length === length && onComplete) setTimeout(() => onComplete(pasted), 150);
    }
  }

  return (
    <div className="otp-input-group" onPaste={handlePaste}>
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { inputRefs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={length}
          className="otp-input"
          value={value[i] || ""}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          autoComplete="one-time-code"
          aria-label={`Digit ${i + 1}`}
        />
      ))}
    </div>
  );
}

// ─── Country Codes ───────────────────────────────────────────────
const COUNTRY_CODES = [
  { code: "+84", country: "VN", name: "Việt Nam" },
  { code: "+1", country: "US", name: "United States" },
  { code: "+44", country: "GB", name: "United Kingdom" },
  { code: "+81", country: "JP", name: "Japan" },
  { code: "+82", country: "KR", name: "South Korea" },
  { code: "+86", country: "CN", name: "China" },
  { code: "+66", country: "TH", name: "Thailand" },
  { code: "+62", country: "ID", name: "Indonesia" },
  { code: "+63", country: "PH", name: "Philippines" },
  { code: "+60", country: "MY", name: "Malaysia" },
  { code: "+65", country: "SG", name: "Singapore" },
];

// ─── SVG Icons ───────────────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
    </svg>
  );
}

// ─── Main Auth Page ──────────────────────────────────────────────

const STEPS = {
  WELCOME: "welcome",
  EMAIL_OTP: "email_otp",
  PHONE_ENTRY: "phone_entry",
  PHONE_OTP: "phone_otp",
};

const fadeSlide = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
};

export default function AuthPage({ onAuthSuccess }) {
  // "login" or "register" — toggles between the two views
  const [authView, setAuthView] = useState("login");
  const [step, setStep] = useState(STEPS.WELCOME);

  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const [phoneCode, setPhoneCode] = useState("+84");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [phoneOtpCode, setPhoneOtpCode] = useState("");
  const [phoneOtpError, setPhoneOtpError] = useState("");
  const [phoneOtpBusy, setPhoneOtpBusy] = useState(false);
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [phoneCountdown, setPhoneCountdown] = useState(0);
  const [phoneSendBusy, setPhoneSendBusy] = useState(false);
  const [successAnim, setSuccessAnim] = useState(false);

  const [busy, setBusy] = useState(false);
  const [emailSendBusy, setEmailSendBusy] = useState(false);
  const [globalError, setGlobalError] = useState("");

  // Countdown timers
  useEffect(() => {
    if (countdown <= 0) return;
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  useEffect(() => {
    if (phoneCountdown <= 0) return;
    const id = setTimeout(() => setPhoneCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [phoneCountdown]);

  // Reset to welcome when toggling view
  function switchView(view) {
    setAuthView(view);
    setStep(STEPS.WELCOME);
    setEmailError("");
    setOtpError("");
    setPhoneError("");
    setPhoneOtpError("");
    setGlobalError("");
  }

  // ─── Email Flow ────────────────────────────────────────────────

  function validateEmail(val) {
    if (!val.trim()) return "Vui lòng nhập email.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return "Email không hợp lệ.";
    return "";
  }

  async function handleEmailSubmit(e) {
    e.preventDefault();
    const err = validateEmail(email);
    if (err) { setEmailError(err); return; }
    setEmailError("");
    setEmailSendBusy(true);
    try {
      await api.sendEmailOTP(email);
      setOtpSent(true);
      setCountdown(60);
      setOtpCode("");
      setStep(STEPS.EMAIL_OTP);
    } catch (err) {
      setEmailError(err.message || "Không gửi được mã. Thử lại sau.");
    }
    setEmailSendBusy(false);
  }

  async function handleEmailOTPVerify(codeOverride) {
    const code = codeOverride || otpCode;
    if (code.length !== 6) { setOtpError("Nhập đủ 6 chữ số."); return; }
    setOtpError("");
    setOtpBusy(true);
    try {
      const result = await api.verifyEmailOTP(email, code);
      setSuccessAnim(true);
      setTimeout(() => onAuthSuccess(result), 600);
    } catch (err) {
      setOtpError(err.message || "Mã không đúng. Thử lại.");
    }
    setOtpBusy(false);
  }

  async function handleResendEmailOTP() {
    if (countdown > 0) return;
    setBusy(true);
    try {
      await api.sendEmailOTP(email);
      setCountdown(60);
      setOtpCode("");
      setOtpError("");
    } catch (err) {
      setOtpError(err.message || "Không gửi lại được mã.");
    }
    setBusy(false);
  }

  // ─── Phone Flow ────────────────────────────────────────────────

  async function handlePhoneSubmit(e) {
    e.preventDefault();
    const digitsOnly = phoneNumber.replace(/\D/g, "");
    if (!digitsOnly || digitsOnly.length < 8) {
      setPhoneError("Số điện thoại không hợp lệ (tối thiểu 8 chữ số).");
      return;
    }
    setPhoneError("");
    setPhoneSendBusy(true);
    try {
      await api.sendPhoneOTP(phoneCode + digitsOnly);
      setPhoneOtpSent(true);
      setPhoneCountdown(60);
      setPhoneOtpCode("");
      setStep(STEPS.PHONE_OTP);
    } catch (err) {
      setPhoneError(err.message || "Không gửi được mã. Thử lại sau.");
    }
    setPhoneSendBusy(false);
  }

  async function handlePhoneOTPVerify(codeOverride) {
    const code = codeOverride || phoneOtpCode;
    if (code.length !== 6) { setPhoneOtpError("Nhập đủ 6 chữ số."); return; }
    setPhoneOtpError("");
    setPhoneOtpBusy(true);
    try {
      const fullPhone = phoneCode + phoneNumber;
      const result = await api.verifyPhoneOTP(fullPhone, code);
      setSuccessAnim(true);
      setTimeout(() => onAuthSuccess(result), 600);
    } catch (err) {
      setPhoneOtpError(err.message || "Mã không đúng. Thử lại.");
    }
    setPhoneOtpBusy(false);
  }

  async function handleResendPhoneOTP() {
    if (phoneCountdown > 0) return;
    setPhoneSendBusy(true);
    try {
      await api.sendPhoneOTP(phoneCode + phoneNumber);
      setPhoneCountdown(60);
      setPhoneOtpCode("");
      setPhoneOtpError("");
    } catch (err) {
      setPhoneOtpError(err.message || "Không gửi lại được mã.");
    }
    setPhoneSendBusy(false);
  }

  // ─── OAuth ─────────────────────────────────────────────────────

  async function handleGoogleLogin() {
    setGlobalError("");
    setBusy(true);
    try {
      const { loadScript } = await import("../lib/loadScript");
      await loadScript("https://accounts.google.com/gsi/client");
      if (!window.google?.accounts?.oauth2) throw new Error("Không tải được Google Sign-In.");
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
      if (!clientId) throw new Error("Đăng nhập Google chưa được cấu hình.");
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: "email profile",
        callback: async (resp) => {
          try {
            if (!resp?.access_token) { setBusy(false); return; }
            const result = await api.oauthGoogle(resp.access_token);
            setSuccessAnim(true);
            setTimeout(() => onAuthSuccess(result), 600);
          } catch (err) {
            setGlobalError(err.message || "Đăng nhập Google thất bại.");
          }
          setBusy(false);
        },
        error_callback: () => { setBusy(false); },
      });
      client.requestAccessToken();
    } catch (err) {
      setGlobalError(err.message);
      setBusy(false);
    }
  }

  async function handleAppleLogin() {
    setGlobalError("");
    setBusy(true);
    try {
      const { loadScript } = await import("../lib/loadScript");
      await loadScript("https://appleid.apple.com/auth/ai.js");
      if (!window.AppleID) throw new Error("Không thể tải Apple Sign-In.");
      const clientId = import.meta.env.VITE_APPLE_CLIENT_ID;
      if (!clientId) throw new Error("Đăng nhập Apple chưa được cấu hình.");
      window.AppleID.auth.init({
        clientId,
        scope: "name email",
        redirectURI: window.location.origin,
        usePopup: true,
      });
      const data = await window.AppleID.auth.signIn();
      if (data?.authorization?.id_token) {
        const result = await api.oauthApple(
          data.authorization.id_token,
          data.user?.name?.firstName,
          data.user?.name?.lastName
        );
        setSuccessAnim(true);
        setTimeout(() => onAuthSuccess(result), 600);
      }
    } catch (err) {
      if (err.error !== "popup_closed_by_user") {
        setGlobalError(err.message || "Đăng nhập Apple bị hủy hoặc gặp lỗi.");
      }
    }
    setBusy(false);
  }

  // ─── Determine subtitle and toggle text based on view ──────────

  const isLogin = authView === "login";
  const subtitle = isLogin
    ? "Chào mừng bạn trở lại"
    : "Tạo tài khoản mới trên 4ANG";
  const emailBtnText = isLogin ? "Tiếp tục với Email" : "Tiếp tục với Email";
  const toggleText = isLogin
    ? "Chưa có tài khoản?"
    : "Đã có tài khoản?";
  const toggleLink = isLogin ? "Đăng ký ngay" : "Đăng nhập";

  // ─── Render ────────────────────────────────────────────────────

  return (
    <div className="auth-page">
      <div className="atmosphere-glow" />
      <div className="atmosphere atmosphere-grain" />

      {/* Botanical decorations */}
      <div className="auth-deco auth-deco-tl"><Vine /></div>
      <div className="auth-deco auth-deco-tr"><Flower size={32} /></div>
      <div className="auth-deco auth-deco-bl"><Flower size={24} /></div>
      <div className="auth-deco auth-deco-br"><Vine /></div>
      <motion.div
        className="auth-deco auth-deco-butterfly"
        animate={{ y: [0, -6, 0], x: [0, 3, 0], rotate: [0, 5, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      >
        <Butterfly size={22} />
      </motion.div>

      <motion.div className="auth-card" {...fadeSlide} key="auth-card">
        <CornerOrnament className="auth-corner auth-corner-tl" />
        <CornerOrnament className="auth-corner auth-corner-br" size={20} />

        {/* Brand */}
        <div className="auth-brand">
          <span className="brand-diamond brand-diamond-lg" />
          <span className="brand-name">4ANG</span>
        </div>

        <>
          {/* ─── Step: Welcome (Login or Register) ─── */}
          {step === STEPS.WELCOME && (
            <div className="auth-step">
              <h1 className="auth-title">Chào mừng đến với 4ANG</h1>
              <p className="auth-subtitle">{subtitle}</p>

              {/* Email form — primary CTA */}
              <form onSubmit={handleEmailSubmit} className="auth-email-form">
                <label className="auth-field-label">Email address</label>
                <div className="auth-email-input-wrap">
                  <Mail size={18} className="auth-email-icon" />
                  <input
                    type="email"
                    className="auth-email-input"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setEmailError(""); }}
                    autoComplete="email"
                    autoFocus
                  />
                </div>
                {emailError && (
                  <motion.p className="auth-error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    {emailError}
                  </motion.p>
                )}
                <button type="submit" className="btn-primary btn-block auth-main-btn" disabled={emailSendBusy}>
                  {emailSendBusy ? (
                    <span className="btn-busy"><Loader2 size={16} className="spin" /> Đang gửi mã...</span>
                  ) : emailBtnText}
                </button>
              </form>

              {/* Divider */}
              <div className="auth-divider"><span>hoặc</span></div>

              {/* Google — always visible */}
              <button type="button" className="auth-social-btn" onClick={handleGoogleLogin} disabled={busy}>
                <GoogleIcon /> {busy ? <span className="btn-busy"><Loader2 size={14} className="spin" /> Đang mở Google...</span> : "Tiếp tục với Google"}
              </button>

              {/* Apple — always visible */}
              <button type="button" className="auth-social-btn" onClick={handleAppleLogin} disabled={busy}>
                <AppleIcon /> {busy ? <span className="btn-busy"><Loader2 size={14} className="spin" /> Đang mở Apple...</span> : "Tiếp tục với Apple"}
              </button>

              {/* Phone — always visible */}
              <button type="button" className="auth-social-btn" onClick={() => { setStep(STEPS.PHONE_ENTRY); setPhoneError(""); }}>
                <Phone size={18} /> Tiếp tục bằng số điện thoại
              </button>

              {/* Global error (OAuth failures) */}
              {globalError && (
                <motion.p className="auth-error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginTop: 12 }}>
                  {globalError}
                </motion.p>
              )}

              {/* Security note */}
              <p className="auth-note">
                <Shield size={14} /> Không cần mật khẩu. Chúng tôi sẽ gửi mã xác minh an toàn.
              </p>

              {/* Toggle login/register */}
              <div className="auth-toggle-row">
                <span>{toggleText}</span>
                <button type="button" className="auth-link-btn" onClick={() => switchView(isLogin ? "register" : "login")}>
                  {toggleLink}
                </button>
              </div>
            </div>
          )}

          {/* ─── Step: Email OTP ─── */}
          {step === STEPS.EMAIL_OTP && (
            <div className="auth-step">
              <button type="button" className="auth-back" onClick={() => { setStep(STEPS.WELCOME); setOtpCode(""); setOtpError(""); setBusy(false); setEmailSendBusy(false); }}>
                <ArrowLeft size={16} /> Quay lại
              </button>

              <div className="otp-header-icon">
                <Mail size={28} />
              </div>

              <h1 className="auth-title auth-title-sm">Kiểm tra hộp thư của bạn</h1>
              <p className="auth-subtitle">
                Chúng tôi đã gửi mã xác minh 6 chữ số đến<br />
                <strong>{maskEmail(email)}</strong>
              </p>

              <OTPInput length={6} value={otpCode} onChange={(v) => { setOtpCode(v); setOtpError(""); }} onComplete={(val) => { setOtpCode(val); handleEmailOTPVerify(val); }} />

              {otpError && (
                <motion.p className="auth-error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  {otpError}
                </motion.p>
              )}

              <button
                type="button"
                className="btn-primary btn-block auth-main-btn"
                onClick={handleEmailOTPVerify}
                disabled={otpBusy || otpCode.length !== 6}
              >
                {otpBusy ? (
                  <span className="btn-busy"><Loader2 size={16} className="spin" /> Đang xác minh...</span>
                ) : "Xác minh"}
              </button>

              <div className="otp-resend">
                {countdown > 0 ? (
                  <span>Gửi lại mã sau <strong>{countdown}s</strong></span>
                ) : (
                  <button type="button" className="auth-link-btn" onClick={handleResendEmailOTP} disabled={busy}>
                    Gửi lại mã
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ─── Step: Phone Entry ─── */}
          {step === STEPS.PHONE_ENTRY && (
            <div className="auth-step">
              <button type="button" className="auth-back" onClick={() => { setStep(STEPS.WELCOME); setPhoneError(""); }}>
                <ArrowLeft size={16} /> Quay lại
              </button>

              <div className="otp-header-icon">
                <Phone size={28} />
              </div>

              <h1 className="auth-title auth-title-sm">Nhập số điện thoại</h1>
              <p className="auth-subtitle">Chúng tôi sẽ gửi mã xác minh để xác thực</p>

              <form onSubmit={handlePhoneSubmit} className="auth-phone-form">
                <div className="auth-phone-row">
                  <select
                    className="auth-phone-code"
                    value={phoneCode}
                    onChange={(e) => setPhoneCode(e.target.value)}
                  >
                    {COUNTRY_CODES.map((c) => (
                      <option key={c.code} value={c.code}>{c.country} {c.code}</option>
                    ))}
                  </select>
                  <input
                    type="tel"
                    className="auth-phone-input"
                    placeholder="Số điện thoại"
                    value={phoneNumber}
                    onChange={(e) => { setPhoneNumber(e.target.value.replace(/[^\d\s\-]/g, "")); setPhoneError(""); }}
                    autoComplete="tel-national"
                    inputMode="numeric"
                    autoFocus
                  />
                </div>
                {phoneError && (
                  <motion.p className="auth-error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    {phoneError}
                  </motion.p>
                )}

                <button type="submit" className="btn-primary btn-block auth-main-btn" disabled={phoneSendBusy}>
                  {phoneSendBusy ? (
                    <span className="btn-busy"><Loader2 size={16} className="spin" /> Đang gửi mã...</span>
                  ) : "Gửi mã xác minh"}
                </button>
              </form>
            </div>
          )}

          {/* ─── Step: Phone OTP ─── */}
          {step === STEPS.PHONE_OTP && (
            <div className="auth-step">
              <button type="button" className="auth-back" onClick={() => { setStep(STEPS.PHONE_ENTRY); setPhoneOtpCode(""); setPhoneOtpError(""); }}>
                <ArrowLeft size={16} /> Quay lại
              </button>

              <div className="otp-header-icon">
                <Phone size={28} />
              </div>

              <h1 className="auth-title auth-title-sm">Xác minh số điện thoại</h1>
              <p className="auth-subtitle">
                Mã xác minh đã gửi đến<br />
                <strong>{phoneCode} {phoneNumber}</strong>
              </p>

              <OTPInput length={6} value={phoneOtpCode} onChange={(v) => { setPhoneOtpCode(v); setPhoneOtpError(""); }} onComplete={(val) => { setPhoneOtpCode(val); handlePhoneOTPVerify(val); }} />

              {phoneOtpError && (
                <motion.p className="auth-error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  {phoneOtpError}
                </motion.p>
              )}

              <button
                type="button"
                className="btn-primary btn-block auth-main-btn"
                onClick={handlePhoneOTPVerify}
                disabled={phoneOtpBusy || phoneOtpCode.length !== 6}
              >
                {phoneOtpBusy ? (
                  <span className="btn-busy"><Loader2 size={16} className="spin" /> Đang xác minh...</span>
                ) : "Xác minh"}
              </button>

              <div className="otp-resend">
                {phoneCountdown > 0 ? (
                  <span>Gửi lại mã sau <strong>{phoneCountdown}s</strong></span>
                ) : (
                  <button type="button" className="auth-link-btn" onClick={handleResendPhoneOTP} disabled={phoneSendBusy}>
                    Gửi lại mã
                  </button>
                )}
              </div>
            </div>
          )}
        </>

        {/* Success animation overlay */}
        <AnimatePresence>
          {successAnim && (
            <motion.div
              className="auth-success-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <motion.div
                className="auth-success-icon"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 20 }}
              >
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </motion.div>
              <motion.p
                className="auth-success-text"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                Đăng nhập thành công!
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

function maskEmail(email) {
  if (!email) return "";
  const [user, domain] = email.split("@");
  if (!domain) return email;
  const masked = user.length <= 2 ? user[0] + "***" : user[0] + "***" + user[user.length - 1];
  return `${masked}@${domain}`;
}
