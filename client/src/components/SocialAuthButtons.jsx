import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { loadScript } from "../lib/loadScript";

// Minimal, monochrome provider marks — intentionally not the official
// multi-color logos, to match the brief's "elegant glass buttons, not
// oversized colorful brand blocks" instruction.
function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4l3 2" />
    </svg>
  );
}
function FacebookMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <path d="M14 8.5h-1.5A2 2 0 0 0 10.5 10.5V12H9v2h1.5v4.5h2V14H14l.4-2h-1.9v-1.3c0-.4.2-.7.7-.7H14V8.5Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export default function SocialAuthButtons({ onSuccess, onError }) {
  const [providers, setProviders] = useState({ google: false, facebook: false });
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(null);
  const fbInitialized = useRef(false);

  useEffect(() => {
    let cancelled = false;
    api.authProviders()
      .then((res) => { if (!cancelled) setProviders(res); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setChecked(true); });
    return () => { cancelled = true; };
  }, []);

  // Client env vars gate real capability too — a provider only ever shows
  // as usable when both the server and this build actually have it wired.
  const canGoogle = checked && providers.google && !!import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const canFacebook = checked && providers.facebook && !!import.meta.env.VITE_FACEBOOK_APP_ID;

  if (!canGoogle && !canFacebook) return null;

  async function handleGoogleClick() {
    if (busy) return;
    setBusy("google");
    try {
      await loadScript("https://accounts.google.com/gsi/client");
      if (!window.google?.accounts?.oauth2) throw new Error("Không tải được dịch vụ đăng nhập Google.");
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        scope: "email profile",
        callback: async (resp) => {
          try {
            if (!resp?.access_token) throw new Error("Đăng nhập Google bị hủy.");
            const result = await api.oauthGoogle(resp.access_token);
            onSuccess(result);
          } catch (err) {
            onError(err.message);
          } finally {
            setBusy(null);
          }
        },
        error_callback: () => { setBusy(null); onError("Đăng nhập Google bị hủy hoặc gặp lỗi."); },
      });
      client.requestAccessToken();
    } catch (err) {
      setBusy(null);
      onError(err.message);
    }
  }

  async function handleFacebookClick() {
    if (busy) return;
    setBusy("facebook");
    try {
      await loadScript("https://connect.facebook.net/en_US/sdk.js");
      if (!window.FB) throw new Error("Không tải được dịch vụ đăng nhập Facebook.");
      if (!fbInitialized.current) {
        window.FB.init({ appId: import.meta.env.VITE_FACEBOOK_APP_ID, version: "v25.0", xfbml: false });
        fbInitialized.current = true;
      }
      window.FB.login(
        async (resp) => {
          try {
            if (!resp?.authResponse) throw new Error("Đăng nhập Facebook bị hủy.");
            const result = await api.oauthFacebook(resp.authResponse.accessToken);
            onSuccess(result);
          } catch (err) {
            onError(err.message);
          } finally {
            setBusy(null);
          }
        },
        { scope: "email public_profile" }
      );
    } catch (err) {
      setBusy(null);
      onError(err.message);
    }
  }

  return (
    <div className="social-auth">
      <div className="social-auth-divider"><span>hoặc tiếp tục với</span></div>
      <div className="social-auth-row">
        {canGoogle && (
          <button type="button" className="social-auth-btn glass" onClick={handleGoogleClick} disabled={!!busy} aria-label="Đăng nhập bằng Google">
            <GoogleMark /> {busy === "google" ? "Đang mở Google..." : "Google"}
          </button>
        )}
        {canFacebook && (
          <button type="button" className="social-auth-btn glass" onClick={handleFacebookClick} disabled={!!busy} aria-label="Đăng nhập bằng Facebook">
            <FacebookMark /> {busy === "facebook" ? "Đang mở Facebook..." : "Facebook"}
          </button>
        )}
      </div>
    </div>
  );
}
