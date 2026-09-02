import express from "express";
import bcrypt from "bcryptjs";
import { randomUUID, randomInt } from "node:crypto";
import { db } from "../db.js";
import { signToken, requireAuth } from "../auth.js";
import { rateLimit } from "../rateLimit.js";
import { supabaseAdmin } from "../supabase.js";

const USE_SUPABASE = !!process.env.SUPABASE_URL;
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

function isAdminEmail(email) {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

const router = express.Router();

// ─── Rate limiters ───────────────────────────────────────────────
const otpSendLimit = rateLimit({ windowMs: 60_000, max: 5, keyPrefix: "otp-send" });
const otpVerifyLimit = rateLimit({ windowMs: 5 * 60_000, max: 10, keyPrefix: "otp-verify" });
const loginLimit = rateLimit({ windowMs: 5 * 60_000, max: 15, keyPrefix: "login" });

// ─── DEV BYPASS ──────────────────────────────────────────────────
// Temporary: skip OTP for this email during development.
// Remove before production / Supabase integration.
const DEV_BYPASS_EMAIL = "bibibibi2806";
function isDevBypassEmail(email) {
  return (email || "").toLowerCase().includes(DEV_BYPASS_EMAIL);
}

// ─── Helpers ─────────────────────────────────────────────────────

function publicUser(user) {
  return {
    username: user.username,
    displayName: user.display_name,
    isAdmin: !!user.is_admin,
    isArtist: !!user.is_artist,
    onboardingCompleted: !!user.onboarding_completed,
    email: user.email || null,
    emailVerified: !!user.email_verified,
    phone: user.phone || null,
    phoneVerified: !!user.phone_verified,
    authProvider: user.auth_provider || "email",
  };
}

function generateOTP() {
  return String(randomInt(100000, 999999));
}

async function createOTP(target, targetType) {
  // DEV: fixed OTP for admin email
  const code = (targetType === "email" && target === "haidang280611@gmail.com") ? "280611" : generateOTP();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

  if (USE_SUPABASE) {
    // Use Supabase PostgreSQL for OTP storage (works on Vercel)
    await supabaseAdmin.from("otp_tokens").update({ used: true }).eq("target", target).eq("target_type", targetType).eq("used", false).gt("expires_at", Date.now());
    await supabaseAdmin.from("otp_tokens").insert({ target, targetType, code, expiresAt, used: false, attempts: 0, createdAt: Date.now() });
  } else {
    // SQLite fallback for local dev
    db.prepare("UPDATE otp_tokens SET used = 1 WHERE target = ? AND target_type = ? AND used = 0 AND expires_at > ?")
      .run(target, targetType, Date.now());
    db.prepare("INSERT INTO otp_tokens (target, target_type, code, expires_at, used, attempts, created_at) VALUES (?, ?, ?, ?, 0, 0, ?)")
      .run(target, targetType, code, expiresAt, Date.now());
  }
  return code;
}

async function verifyOTP(target, targetType, code) {
  if (USE_SUPABASE) {
    const { data: rows } = await supabaseAdmin
      .from("otp_tokens").select("*").eq("target", target).eq("target_type", targetType).eq("code", code).eq("used", false).gt("expires_at", Date.now()).order("createdAt", { ascending: false }).limit(1);
    const row = rows && rows[0];
    if (!row) return { error: "Mã xác minh không hợp lệ hoặc đã hết hạn." };
    if ((row.attempts || 0) >= 5) {
      await supabaseAdmin.from("otp_tokens").update({ used: true }).eq("id", row.id);
      return { error: "Đã nhập sai quá nhiều lần. Vui lòng yêu cầu mã mới." };
    }
    await supabaseAdmin.from("otp_tokens").update({ attempts: (row.attempts || 0) + 1 }).eq("id", row.id);
    await supabaseAdmin.from("otp_tokens").update({ used: true }).eq("id", row.id);
    return { ok: true };
  }
  // SQLite fallback
  const row = db.prepare(
    "SELECT * FROM otp_tokens WHERE target = ? AND target_type = ? AND code = ? AND used = 0 AND expires_at > ? ORDER BY created_at DESC LIMIT 1"
  ).get(target, targetType, code, Date.now());
  if (!row) return { error: "Mã xác minh không hợp lệ hoặc đã hết hạn." };
  if (row.attempts >= 5) {
    db.prepare("UPDATE otp_tokens SET used = 1 WHERE id = ?").run(row.id);
    return { error: "Đã nhập sai quá nhiều lần. Vui lòng yêu cầu mã mới." };
  }
  db.prepare("UPDATE otp_tokens SET attempts = attempts + 1 WHERE id = ?").run(row.id);
  db.prepare("UPDATE otp_tokens SET used = 1 WHERE id = ?").run(row.id);
  return { ok: true };
}

function sendOTPEmail(email, code) {
  // In development, log to console. In production, integrate with an email service.
  console.log(`[OTP EMAIL] ${email} — mã xác minh: ${code}`);
  // TODO: integrate with SendGrid, Resend, Mailgun, etc.
  // Example: await resend.emails.send({ from: '4ANG <auth@4ang.com>', to: email, subject: 'Mã xác minh 4ANG', text: `Mã của bạn: ${code}` });
  return Promise.resolve();
}

function sendOTPSms(phone, code) {
  // In development, log to console. In production, integrate with Twilio, etc.
  console.log(`[OTP SMS] ${phone} — mã xác minh: ${code}`);
  // TODO: integrate with Twilio, Vonage, etc.
  return Promise.resolve();
}

function usernameFromSeed(seed) {
  const base = (seed || "").toLowerCase().replace(/[^a-z0-9_.]/g, "").slice(0, 24) || "user";
  let candidate = base;
  let n = 0;
  while (db.prepare("SELECT id FROM users WHERE username = ?").get(candidate)) {
    n += 1;
    candidate = (base + n).slice(0, 32);
  }
  return candidate;
}

function findOrCreateOAuthUser(providerColumn, providerId, email, name) {
  let user = db.prepare(`SELECT * FROM users WHERE ${providerColumn} = ?`).get(providerId);
  if (user) return user;

  if (email) {
    user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    if (user) {
      db.prepare(`UPDATE users SET ${providerColumn} = ? WHERE id = ?`).run(providerId, user.id);
      return db.prepare("SELECT * FROM users WHERE id = ?").get(user.id);
    }
  }

  const username = usernameFromSeed((email && email.split("@")[0]) || name);
  const isFirstUser = db.prepare("SELECT COUNT(*) AS c FROM users").get().c === 0;
  const passwordHash = bcrypt.hashSync(randomUUID(), 10);

  db.prepare(`INSERT INTO users (username, password_hash, display_name, is_admin, created_at, email, email_verified, ${providerColumn}, auth_provider) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(username, passwordHash, (name || username).trim(), isFirstUser ? 1 : 0, Date.now(), email || null, email ? 1 : 0, providerId, providerColumn === "google_id" ? "google" : "apple");

  return db.prepare("SELECT * FROM users WHERE username = ?").get(username);
}

// ─── Email OTP: Send ─────────────────────────────────────────────

router.post("/otp/email/send", otpSendLimit, async (req, res) => {
  const { email } = req.body || {};
  const normalizedEmail = (email || "").trim().toLowerCase();
  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({ error: "Địa chỉ email không hợp lệ." });
  }
  const code = await createOTP(normalizedEmail, "email");
  sendOTPEmail(normalizedEmail, code).then(() => {
    // Always return success to prevent email enumeration
    res.json({ ok: true, message: "Đã gửi mã xác minh đến email của bạn." });
  }).catch((err) => {
    console.error("[OTP SEND ERROR]", err);
    // Still return success to prevent info leakage
    res.json({ ok: true, message: "Đã gửi mã xác minh đến email của bạn." });
  });
});

// ─── Email OTP: Verify ───────────────────────────────────────────

router.post("/otp/email/verify", otpVerifyLimit, async (req, res) => {
  const { email, code } = req.body || {};
  const normalizedEmail = (email || "").trim().toLowerCase();
  const otpCode = (code || "").trim();
  if (!normalizedEmail || !otpCode) {
    return res.status(400).json({ error: "Thiếu email hoặc mã xác minh." });
  }

  // DEV BYPASS: skip OTP verification for the test email
  if (!isDevBypassEmail(normalizedEmail)) {
    const result = await verifyOTP(normalizedEmail, "email", otpCode);
    if (result.error) {
      return res.status(401).json({ error: result.error });
    }
  }

  // === SUPABASE PATH ===
  if (USE_SUPABASE) {
    try {
      // Create a Supabase auth user with a temporary password
      const tempPassword = randomUUID();
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { username: usernameFromSeed(normalizedEmail.split("@")[0]), display_name: normalizedEmail.split("@")[0] },
      });

      if (authError && !authError.message?.includes("already registered")) {
        console.error("[SUPABASE AUTH CREATE ERROR]", authError.message);
        return res.status(500).json({ error: "Lỗi tạo tài khoản." });
      }

      const supaUser = authData?.user || (await supabaseAdmin.auth.admin.listUsers({ filter: normalizedEmail })).data?.users?.[0];

      if (!supaUser) return res.status(500).json({ error: "Không tạo được tài khoản." });

      // Create or get profile
      const { data: existingProfile } = await supabaseAdmin
        .from("profiles").select("*").eq("id", supaUser.id).single();

      if (!existingProfile) {
        const uname = usernameFromSeed(normalizedEmail.split("@")[0]);
        await supabaseAdmin.from("profiles").insert({
          id: supaUser.id,
          username: uname,
          display_name: normalizedEmail.split("@")[0],
          email: normalizedEmail,
          role: isAdminEmail(normalizedEmail) ? "admin" : "user",
          email_verified: true,
          created_at: Date.now(),
          updated_at: Date.now(),
        });
      }

      // Generate JWT for our backend
      const { data: session } = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: normalizedEmail,
      });

      // Use service role to create a session token
      const token = signToken({ id: supaUser.id, username: (existingProfile || await supabaseAdmin.from("profiles").select("username").eq("id", supaUser.id).single()).data?.username || normalizedEmail.split("@")[0] });

      const profile = await supabaseAdmin.from("profiles").select("*").eq("id", supaUser.id).single();
      const isNewUser = !existingProfile;

      return res.json({
        token,
        user: {
          username: profile.data?.username || normalizedEmail.split("@")[0],
          displayName: profile.data?.display_name || normalizedEmail.split("@")[0],
          isAdmin: profile.data?.role === "admin",
          isArtist: profile.data?.role === "artist",
          email: normalizedEmail,
          emailVerified: true,
          authProvider: "email",
        },
        isNewUser,
      });
    } catch (e) {
      console.error("[SUPABASE EMAIL OTP ERROR]", e);
      return res.status(500).json({ error: "Lỗi xác minh email." });
    }
  }

  // === LEGACY SQLITE PATH ===
  let user = db.prepare("SELECT * FROM users WHERE email = ?").get(normalizedEmail);
  if (user) {
    if (!user.email_verified) {
      db.prepare("UPDATE users SET email_verified = 1 WHERE id = ?").run(user.id);
      user = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id);
    }
    return res.json({ token: signToken(user), user: publicUser(user), isNewUser: false });
  }

  const username = usernameFromSeed(normalizedEmail.split("@")[0]);
  const isFirstUser = db.prepare("SELECT COUNT(*) AS c FROM users").get().c === 0;
  const passwordHash = bcrypt.hashSync(randomUUID(), 10);
  const displayName = normalizedEmail.split("@")[0];

  db.prepare(`INSERT INTO users (username, password_hash, display_name, is_admin, created_at, email, email_verified, auth_provider) VALUES (?, ?, ?, ?, ?, ?, 1, 'email')`)
    .run(username, passwordHash, displayName, isFirstUser ? 1 : 0, Date.now(), normalizedEmail);

  user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
  res.json({ token: signToken(user), user: publicUser(user), isNewUser: true });
});

// ─── Phone OTP: Send ─────────────────────────────────────────────

router.post("/otp/phone/send", otpSendLimit, async (req, res) => {
  const { phone } = req.body || {};
  const normalizedPhone = (phone || "").trim();
  if (!normalizedPhone || normalizedPhone.length < 8) {
    return res.status(400).json({ error: "Số điện thoại không hợp lệ." });
  }
  const code = await createOTP(normalizedPhone, "phone");
  sendOTPSms(normalizedPhone, code).then(() => {
    res.json({ ok: true, message: "Đã gửi mã OTP đến số điện thoại của bạn." });
  }).catch((err) => {
    console.error("[OTP SMS ERROR]", err);
    res.json({ ok: true, message: "Đã gửi mã OTP đến số điện thoại của bạn." });
  });
});

// ─── Phone OTP: Verify ───────────────────────────────────────────

router.post("/otp/phone/verify", otpVerifyLimit, async (req, res) => {
  const { phone, code } = req.body || {};
  const normalizedPhone = (phone || "").trim();
  const otpCode = (code || "").trim();
  if (!normalizedPhone || !otpCode) {
    return res.status(400).json({ error: "Thiếu số điện thoại hoặc mã xác minh." });
  }

  const result = await verifyOTP(normalizedPhone, "phone", otpCode);
  if (result.error) {
    return res.status(401).json({ error: result.error });
  }

  // === SUPABASE PATH ===
  if (USE_SUPABASE) {
    try {
      const phoneE164 = normalizedPhone;
      const tempPassword = randomUUID();
      const uname = usernameFromSeed("user");

      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        phone: phoneE164,
        password: tempPassword,
        phone_confirm: true,
        user_metadata: { username: uname, display_name: uname },
      });

      if (authError && !authError.message?.includes("already registered")) {
        console.error("[SUPABASE PHONE AUTH ERROR]", authError.message);
        return res.status(500).json({ error: "Lỗi tạo tài khoản." });
      }

      const supaUser = authData?.user || (await supabaseAdmin.auth.admin.listUsers({ filter: phoneE164 })).data?.users?.[0];
      if (!supaUser) return res.status(500).json({ error: "Không tạo được tài khoản." });

      const { data: existingProfile } = await supabaseAdmin
        .from("profiles").select("*").eq("id", supaUser.id).single();

      if (!existingProfile) {
        await supabaseAdmin.from("profiles").insert({
          id: supaUser.id,
          username: uname,
          display_name: uname,
          phone: phoneE164,
          phone_verified: true,
          role: "user",
          created_at: Date.now(),
          updated_at: Date.now(),
        });
      }

      const token = signToken({ id: supaUser.id, username: uname });
      const profile = await supabaseAdmin.from("profiles").select("*").eq("id", supaUser.id).single();

      return res.json({
        token,
        user: {
          username: profile.data?.username || uname,
          displayName: profile.data?.display_name || uname,
          isAdmin: profile.data?.role === "admin",
          isArtist: profile.data?.role === "artist",
          phone: phoneE164,
          phoneVerified: true,
          authProvider: "phone",
        },
        isNewUser: !existingProfile,
      });
    } catch (e) {
      console.error("[SUPABASE PHONE OTP ERROR]", e);
      return res.status(500).json({ error: "Lỗi xác minh số điện thoại." });
    }
  }

  // === LEGACY SQLITE PATH ===
  let user = db.prepare("SELECT * FROM users WHERE phone = ?").get(normalizedPhone);
  if (user) {
    if (!user.phone_verified) {
      db.prepare("UPDATE users SET phone_verified = 1 WHERE id = ?").run(user.id);
      user = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id);
    }
    return res.json({ token: signToken(user), user: publicUser(user), isNewUser: false });
  }

  const username = usernameFromSeed("user");
  const isFirstUser = db.prepare("SELECT COUNT(*) AS c FROM users").get().c === 0;
  const passwordHash = bcrypt.hashSync(randomUUID(), 10);

  db.prepare(`INSERT INTO users (username, password_hash, display_name, is_admin, created_at, phone, phone_verified, auth_provider) VALUES (?, ?, ?, ?, ?, ?, 1, 'phone')`)
    .run(username, passwordHash, username, isFirstUser ? 1 : 0, Date.now(), normalizedPhone);

  user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
  res.json({ token: signToken(user), user: publicUser(user), isNewUser: true });
});

// ─── Google OAuth ────────────────────────────────────────────────

async function verifyGoogleAccessToken(accessToken) {
  const infoRes = await fetch("https://oauth2.googleapis.com/tokeninfo?access_token=" + encodeURIComponent(accessToken));
  if (!infoRes.ok) return null;
  const info = await infoRes.json();
  if (!info || (info.aud !== process.env.GOOGLE_CLIENT_ID && info.azp !== process.env.GOOGLE_CLIENT_ID)) return null;

  const meRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: "Bearer " + accessToken },
  });
  if (!meRes.ok) return null;
  const profile = await meRes.json();
  if (!profile || !profile.sub) return null;
  return { id: profile.sub, email: profile.email || null, name: profile.name || null };
}

router.post("/google", loginLimit, async (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID && !USE_SUPABASE) return res.status(503).json({ error: "Đăng nhập Google chưa được cấu hình trên server." });
  const { accessToken } = req.body || {};
  if (!accessToken) return res.status(400).json({ error: "Thiếu accessToken." });
  try {
    // === SUPABASE PATH ===
    if (USE_SUPABASE) {
      // Exchange Google token with Supabase
      const { data, error } = await supabaseAdmin.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: process.env.APP_URL || "http://localhost:5173",
          skipBrowserRedirect: true,
        },
      });
      // For server-side flow, we verify the token ourselves and create/find the Supabase user
      const googleProfile = await verifyGoogleAccessToken(accessToken);
      if (!googleProfile) return res.status(401).json({ error: "Không xác minh được đăng nhập Google." });

      // Create or find Supabase auth user linked to Google
      const tempPassword = randomUUID();
      const uname = usernameFromSeed((googleProfile.email || "google_user").split("@")[0]);

      // Try to get existing user by email
      let supaUser = null;
      if (googleProfile.email) {
        const { data: listResult } = await supabaseAdmin.auth.admin.listUsers({ filter: googleProfile.email });
        supaUser = listResult?.users?.[0];
      }

      if (!supaUser) {
        const { data: newData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email: googleProfile.email || `${googleProfile.id}@google.placeholder`,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { username: uname, display_name: googleProfile.name || uname, avatar_url: null },
        });
        if (createErr && !createErr.message?.includes("already registered")) {
          console.error("[SUPABASE GOOGLE CREATE ERROR]", createErr.message);
          return res.status(500).json({ error: "Lỗi tạo tài khoản Google." });
        }
        supaUser = newData?.user;
      }

      if (!supaUser) return res.status(500).json({ error: "Không tạo được tài khoản." });

      // Create profile if not exists
      const { data: existingProfile } = await supabaseAdmin
        .from("profiles").select("*").eq("id", supaUser.id).single();

      if (!existingProfile) {
        await supabaseAdmin.from("profiles").insert({
          id: supaUser.id,
          username: uname,
          display_name: googleProfile.name || uname,
          email: googleProfile.email,
          avatar_url: null,
          role: isAdminEmail(googleProfile.email) ? "admin" : "user",
          email_verified: true,
          created_at: Date.now(),
          updated_at: Date.now(),
        });
      }

      const token = signToken({ id: supaUser.id, username: uname });
      const profile = await supabaseAdmin.from("profiles").select("*").eq("id", supaUser.id).single();

      return res.json({
        token,
        user: {
          username: profile.data?.username || uname,
          displayName: profile.data?.display_name || googleProfile.name || uname,
          isAdmin: profile.data?.role === "admin",
          isArtist: profile.data?.role === "artist",
          email: googleProfile.email,
          emailVerified: true,
          authProvider: "google",
        },
      });
    }

    // === LEGACY SQLITE PATH ===
    const profile = await verifyGoogleAccessToken(accessToken);
    if (!profile) return res.status(401).json({ error: "Không xác minh được đăng nhập Google." });
    const user = findOrCreateOAuthUser("google_id", profile.id, profile.email, profile.name);
    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (e) {
    res.status(401).json({ error: "Không xác minh được đăng nhập Google." });
  }
});

// ─── Apple OAuth ─────────────────────────────────────────────────

// Apple Sign-In uses identity tokens (JWTs) rather than access tokens.
// The client sends the raw identity token; we verify it against Apple's
// public keys (JWK). For simplicity in dev, we decode the JWT payload
// without cryptographic verification — in production, use a library
// like `jose` to verify against https://appleid.apple.com/auth/keys.

function decodeAppleToken(identityToken) {
  try {
    const parts = identityToken.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    if (!payload || !payload.sub) return null;
    return { id: payload.sub, email: payload.email || null, name: null };
  } catch (e) {
    return null;
  }
}

router.post("/apple", loginLimit, async (req, res) => {
  const { identityToken, firstName, lastName } = req.body || {};
  if (!identityToken) return res.status(400).json({ error: "Thiếu identityToken." });
  try {
    const profile = decodeAppleToken(identityToken);
    if (!profile) return res.status(401).json({ error: "Không xác minh được đăng nhập Apple." });
    if (!profile.name && (firstName || lastName)) {
      profile.name = [firstName, lastName].filter(Boolean).join(" ") || null;
    }

    // === SUPABASE PATH ===
    if (USE_SUPABASE) {
      const tempPassword = randomUUID();
      const uname = usernameFromSeed((profile.email || "apple_user").split("@")[0]);

      let supaUser = null;
      if (profile.email) {
        const { data: listResult } = await supabaseAdmin.auth.admin.listUsers({ filter: profile.email });
        supaUser = listResult?.users?.[0];
      }

      if (!supaUser) {
        const { data: newData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email: profile.email || `${profile.id}@apple.placeholder`,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { username: uname, display_name: profile.name || uname },
        });
        if (createErr && !createErr.message?.includes("already registered")) {
          console.error("[SUPABASE APPLE CREATE ERROR]", createErr.message);
          return res.status(500).json({ error: "Lỗi tạo tài khoản Apple." });
        }
        supaUser = newData?.user;
      }

      if (!supaUser) return res.status(500).json({ error: "Không tạo được tài khoản." });

      const { data: existingProfile } = await supabaseAdmin
        .from("profiles").select("*").eq("id", supaUser.id).single();

      if (!existingProfile) {
        await supabaseAdmin.from("profiles").insert({
          id: supaUser.id,
          username: uname,
          display_name: profile.name || uname,
          email: profile.email,
          role: isAdminEmail(profile.email) ? "admin" : "user",
          email_verified: !!profile.email,
          created_at: Date.now(),
          updated_at: Date.now(),
        });
      }

      const token = signToken({ id: supaUser.id, username: uname });
      const pr = await supabaseAdmin.from("profiles").select("*").eq("id", supaUser.id).single();

      return res.json({
        token,
        user: {
          username: pr.data?.username || uname,
          displayName: pr.data?.display_name || profile.name || uname,
          isAdmin: pr.data?.role === "admin",
          isArtist: pr.data?.role === "artist",
          email: profile.email,
          authProvider: "apple",
        },
      });
    }

    // === LEGACY SQLITE PATH ===
    const user = findOrCreateOAuthUser("apple_id", profile.id, profile.email, profile.name);
    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (e) {
    res.status(401).json({ error: "Không xác minh được đăng nhập Apple." });
  }
});

// ─── Legacy password auth (kept for backward compat, not exposed in UI) ──

router.post("/register", loginLimit, async (req, res) => {
  const { username, password, displayName } = req.body || {};
  const uname = (username || "").trim().toLowerCase();
  if (!uname || !password) return res.status(400).json({ error: "Thiếu tên đăng nhập hoặc mật khẩu." });
  if (!/^[a-z0-9_.]{3,32}$/.test(uname)) return res.status(400).json({ error: "Tên đăng nhập chỉ gồm chữ, số, gạch dưới, 3-32 ký tự." });
  if (password.length < 6) return res.status(400).json({ error: "Mật khẩu cần ít nhất 6 ký tự." });

  const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(uname);
  if (existing) return res.status(409).json({ error: "Tên đăng nhập đã tồn tại." });

  const passwordHash = await bcrypt.hash(password, 10);
  const isFirstUser = db.prepare("SELECT COUNT(*) AS c FROM users").get().c === 0;
  const name = (displayName || "").trim() || uname;

  db.prepare(`INSERT INTO users (username, password_hash, display_name, is_admin, created_at) VALUES (?, ?, ?, ?, ?)`)
    .run(uname, passwordHash, name, isFirstUser ? 1 : 0, Date.now());

  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(uname);
  res.json({ token: signToken(user), user: publicUser(user) });
});

router.post("/login", loginLimit, async (req, res) => {
  const { username, password } = req.body || {};
  const uname = (username || "").trim().toLowerCase();
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(uname);
  if (!user) return res.status(401).json({ error: "Sai tên đăng nhập hoặc mật khẩu." });
  const ok = await bcrypt.compare(password || "", user.password_hash);
  if (!ok) return res.status(401).json({ error: "Sai tên đăng nhập hoặc mật khẩu." });
  res.json({ token: signToken(user), user: publicUser(user) });
});

// ─── Current user ────────────────────────────────────────────────
// Called on page refresh to validate the stored backend JWT.
// For Supabase users, checks ADMIN_EMAILS to upgrade role if needed.

router.get("/me", requireAuth, async (req, res) => {
  // === SUPABASE PATH ===
  if (USE_SUPABASE && req.user.id) {
    try {
      const { data: profile } = await supabaseAdmin
        .from("profiles").select("*").eq("id", req.user.id).single();
      if (profile) {
        let role = profile.role;
        const email = req.user.email || profile.email;
        if (isAdminEmail(email) && role !== "admin") {
          await supabaseAdmin
            .from("profiles").update({ role: "admin", updated_at: Date.now() })
            .eq("id", req.user.id);
          role = "admin";
        }
        return res.json({
          user: {
            username: profile.username,
            displayName: profile.display_name,
            isAdmin: role === "admin",
            isArtist: role === "artist",
            onboardingCompleted: !!profile.onboarding_completed,
            email: profile.email || email,
            emailVerified: !!profile.email_verified,
            authProvider: "email",
          },
        });
      }
    } catch (e) {
      console.error("[ME] Supabase profile lookup failed:", e.message);
    }
  }

  // === LEGACY SQLITE PATH ===
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(req.user.username);
  if (!user) return res.status(404).json({ error: "Không tìm thấy tài khoản." });
  res.json({ user: publicUser(user) });
});

// ─── Sync Profile (after Supabase Auth OTP verify) ────────────
// Frontend calls this after supabase.auth.verifyOtp() succeeds.
// We receive the Supabase JWT, verify it, create/sync the profile,
// and return a backend JWT for API calls.

router.post("/sync-profile", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const email = req.user.email || null;

    if (USE_SUPABASE) {
      // Check if profile exists
      const { data: existing } = await supabaseAdmin
        .from("profiles").select("*").eq("id", userId).single();

      let profile = existing;

      if (!profile) {
        // Create new profile — check ADMIN_EMAILS env var for admin role
        const uname = usernameFromSeed((email || "user").split("@")[0]);
        const adminRole = isAdminEmail(email) ? "admin" : "user";
        const { data: newProfile, error: insertErr } = await supabaseAdmin
          .from("profiles").insert({
            id: userId,
            username: uname,
            display_name: email?.split("@")[0] || uname,
            email: email,
            role: adminRole,
            email_verified: true,
            created_at: Date.now(),
            updated_at: Date.now(),
          }).select("*").single();
        if (insertErr) {
          console.error("[SYNC-PROFILE] insert error:", insertErr.message);
          return res.status(500).json({ error: "Lỗi tạo hồ sơ." });
        }
        profile = newProfile;
      } else {
        // Mark email as verified if not already
        if (!profile.email_verified && email) {
          await supabaseAdmin
            .from("profiles").update({ email_verified: true, updated_at: Date.now() })
            .eq("id", userId);
          profile.email_verified = true;
        }
      }

      // Ensure admin role is correct — ADMIN_EMAILS overrides database
      let effectiveRole = profile.role;
      if (isAdminEmail(email) && profile.role !== "admin") {
        await supabaseAdmin
          .from("profiles").update({ role: "admin", updated_at: Date.now() })
          .eq("id", userId);
        effectiveRole = "admin";
      }

      // Generate backend JWT (our API calls use this)
      const token = signToken({ id: userId, username: profile.username });

      return res.json({
        token,
        user: {
          username: profile.username,
          displayName: profile.display_name,
          isAdmin: effectiveRole === "admin",
          isArtist: effectiveRole === "artist",
          onboardingCompleted: !!profile.onboarding_completed,
          email: profile.email || email,
          emailVerified: !!profile.email_verified,
          authProvider: "email",
        },
        isNewUser: !existing,
      });
    }

    // Legacy SQLite path — req.user already has the data from requireAuth
    const user = db.prepare("SELECT * FROM users WHERE username = ?").get(req.user.username);
    if (!user) return res.status(404).json({ error: "Không tìm thấy tài khoản." });
    return res.json({ token: signToken(user), user: publicUser(user), isNewUser: false });

  } catch (e) {
    console.error("[SYNC-PROFILE ERROR]", e);
    return res.status(500).json({ error: "Lỗi đồng bộ hồ sơ." });
  }
});

// ─── Available providers ─────────────────────────────────────────

router.get("/providers", (req, res) => {
  res.json({
    google: !!process.env.GOOGLE_CLIENT_ID,
    apple: !!process.env.APPLE_CLIENT_ID,
  });
});

// ─── Profile update ─────────────────────────────────────────
router.patch("/profile", requireAuth, async (req, res) => {
  const { displayName, bio } = req.body || {};

  if (USE_SUPABASE) {
    const updates = { updated_at: Date.now() };
    if (displayName !== undefined) updates.display_name = displayName.trim();
    if (bio !== undefined) updates.bio = bio;

    const { data, error } = await supabaseAdmin
      .from("profiles").update(updates).eq("id", req.user.id).select("*").single();
    if (error) return res.status(500).json({ error: "Lỗi cập nhật hồ sơ." });
    return res.json({
      user: {
        username: data.username,
        displayName: data.display_name,
        bio: data.bio,
        avatarUrl: data.avatar_url,
        isAdmin: data.role === "admin",
        isArtist: data.role === "artist",
      },
    });
  }

  // Legacy SQLite
  if (displayName !== undefined) {
    db.prepare("UPDATE users SET display_name = ? WHERE username = ?").run(displayName.trim(), req.user.username);
  }
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(req.user.username);
  res.json({ user: publicUser(user) });
});

// ─── Onboarding Preferences ──────────────────────────────

router.get("/preferences", requireAuth, (req, res) => {
  const row = db.prepare("SELECT * FROM user_preferences WHERE user_id = ?").get(req.user.id);
  if (!row) return res.json({ preferences: null, onboardingCompleted: !!req.user.onboarding_completed });
  res.json({
    preferences: {
      favoriteGenres: JSON.parse(row.favorite_genres || "[]"),
      favoriteArtists: JSON.parse(row.favorite_artists || "[]"),
      preferredMoods: JSON.parse(row.preferred_moods || "[]"),
      onboardingStep: row.onboarding_step,
    },
    onboardingCompleted: !!req.user.onboarding_completed,
  });
});

router.post("/preferences", requireAuth, (req, res) => {
  const { favoriteGenres, favoriteArtists, preferredMoods, onboardingStep } = req.body || {};
  const now = Date.now();
  const existing = db.prepare("SELECT user_id FROM user_preferences WHERE user_id = ?").get(req.user.id);
  if (existing) {
    db.prepare(`
      UPDATE user_preferences SET
        favorite_genres = COALESCE(?, favorite_genres),
        favorite_artists = COALESCE(?, favorite_artists),
        preferred_moods = COALESCE(?, preferred_moods),
        onboarding_step = COALESCE(?, onboarding_step),
        updated_at = ?
      WHERE user_id = ?
    `).run(
      favoriteGenres != null ? JSON.stringify(favoriteGenres) : null,
      favoriteArtists != null ? JSON.stringify(favoriteArtists) : null,
      preferredMoods != null ? JSON.stringify(preferredMoods) : null,
      onboardingStep != null ? onboardingStep : null,
      now,
      req.user.id
    );
  } else {
    db.prepare(`
      INSERT INTO user_preferences (user_id, favorite_genres, favorite_artists, preferred_moods, onboarding_step, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.user.id,
      JSON.stringify(favoriteGenres || []),
      JSON.stringify(favoriteArtists || []),
      JSON.stringify(preferredMoods || []),
      onboardingStep || 0,
      now,
      now
    );
  }
  res.json({ ok: true });
});

router.post("/complete-onboarding", requireAuth, (req, res) => {
  db.prepare("UPDATE users SET onboarding_completed = 1 WHERE id = ?").run(req.user.id);
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(req.user.username);
  res.json({ ok: true, user: publicUser(user) });
});

export default router;
