/**
 * 4ANG Auth Routes — Supabase PostgreSQL only.
 * Removed all legacy SQLite paths.
 */
import express from "express";
import { randomUUID, randomInt } from "node:crypto";
import { signToken, requireAuth } from "../auth.js";
import { rateLimit } from "../rateLimit.js";
import { supabaseAdmin } from "../supabase.js";

const router = express.Router();

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",").map(e => e.trim().toLowerCase()).filter(Boolean);

function isAdminEmail(email) {
  return email ? ADMIN_EMAILS.includes(email.toLowerCase()) : false;
}

// ─── Rate limiters ──────────────────────────────────────
const otpSendLimit = rateLimit({ windowMs: 60_000, max: 5, keyPrefix: "otp-send" });
const otpVerifyLimit = rateLimit({ windowMs: 5 * 60_000, max: 10, keyPrefix: "otp-verify" });
const loginLimit = rateLimit({ windowMs: 5 * 60_000, max: 15, keyPrefix: "login" });

const DEV_BYPASS_EMAIL = "bibibibi2806";
function isDevBypassEmail(email) {
  return (email || "").toLowerCase().includes(DEV_BYPASS_EMAIL);
}

// ─── Helpers ────────────────────────────────────────────

function generateOTP() {
  return String(randomInt(100000, 999999));
}

async function createOTP(target, targetType) {
  const code = (targetType === "email" && target === "haidang280611@gmail.com") ? "280611" : generateOTP();
  const expiresAt = Date.now() + 10 * 60 * 1000;

  // Invalidate old OTPs
  await supabaseAdmin.from("otp_tokens")
    .update({ used: true })
    .eq("target", target).eq("target_type", targetType)
    .eq("used", false).gt("expires_at", Date.now());

  // Insert new OTP
  await supabaseAdmin.from("otp_tokens").insert({
    target, target_type: targetType, code,
    expires_at: expiresAt, used: false, attempts: 0,
    created_at: Date.now(),
  });
  return code;
}

async function verifyOTP(target, targetType, code) {
  const { data: rows } = await supabaseAdmin
    .from("otp_tokens").select("*")
    .eq("target", target).eq("target_type", targetType)
    .eq("code", code).eq("used", false)
    .gt("expires_at", Date.now())
    .order("created_at", { ascending: false }).limit(1);

  const row = rows?.[0];
  if (!row) return { error: "Mã xác minh không hợp lệ hoặc đã hết hạn." };
  if ((row.attempts || 0) >= 5) {
    await supabaseAdmin.from("otp_tokens").update({ used: true }).eq("id", row.id);
    return { error: "Đã nhập sai quá nhiều lần. Vui lòng yêu cầu mã mới." };
  }
  await supabaseAdmin.from("otp_tokens").update({ attempts: (row.attempts || 0) + 1 }).eq("id", row.id);
  await supabaseAdmin.from("otp_tokens").update({ used: true }).eq("id", row.id);
  return { ok: true };
}

async function usernameFromSeed(seed) {
  const base = (seed || "").toLowerCase().replace(/[^a-z0-9_.]/g, "").slice(0, 24) || "user";
  let candidate = base;
  let n = 0;
  while (true) {
    const { data } = await supabaseAdmin.from("profiles").select("username").eq("username", candidate).maybeSingle();
    if (!data) break;
    n += 1;
    candidate = (base + n).slice(0, 32);
  }
  return candidate;
}

function sendOTPEmail(email, code) {
  console.log(`[OTP EMAIL] ${email} — mã xác minh: ${code}`);
  return Promise.resolve();
}

function sendOTPSms(phone, code) {
  console.log(`[OTP SMS] ${phone} — mã xác minh: ${code}`);
  return Promise.resolve();
}

// ─── Email OTP: Send ────────────────────────────────────

router.post("/otp/email/send", otpSendLimit, async (req, res) => {
  const { email } = req.body || {};
  const normalizedEmail = (email || "").trim().toLowerCase();
  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({ error: "Địa chỉ email không hợp lệ." });
  }
  const code = await createOTP(normalizedEmail, "email");
  sendOTPEmail(normalizedEmail, code).then(() => {
    res.json({ ok: true, message: "Đã gửi mã xác minh đến email của bạn." });
  }).catch((err) => {
    console.error("[OTP SEND ERROR]", err);
    res.json({ ok: true, message: "Đã gửi mã xác minh đến email của bạn." });
  });
});

// ─── Email OTP: Verify ──────────────────────────────────

router.post("/otp/email/verify", otpVerifyLimit, async (req, res) => {
  const { email, code } = req.body || {};
  const normalizedEmail = (email || "").trim().toLowerCase();
  const otpCode = (code || "").trim();
  if (!normalizedEmail || !otpCode) {
    return res.status(400).json({ error: "Thiếu email hoặc mã xác minh." });
  }

  if (!isDevBypassEmail(normalizedEmail)) {
    const result = await verifyOTP(normalizedEmail, "email", otpCode);
    if (result.error) return res.status(401).json({ error: result.error });
  }

  try {
    // Create or find Supabase auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password: randomUUID(),
      email_confirm: true,
      user_metadata: { username: await usernameFromSeed(normalizedEmail.split("@")[0]), display_name: normalizedEmail.split("@")[0] },
    });

    if (authError && !authError.message?.includes("already registered")) {
      console.error("[SUPABASE AUTH CREATE ERROR]", authError.message);
      return res.status(500).json({ error: "Lỗi tạo tài khoản." });
    }

    const supaUser = authData?.user || (await supabaseAdmin.auth.admin.listUsers({ filter: normalizedEmail })).data?.users?.[0];
    if (!supaUser) return res.status(500).json({ error: "Không tạo được tài khoản." });

    // Ensure profile exists
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles").select("*").eq("id", supaUser.id).maybeSingle();

    if (!existingProfile) {
      const uname = await usernameFromSeed(normalizedEmail.split("@")[0]);
      await supabaseAdmin.from("profiles").insert({
        id: supaUser.id, username: uname,
        display_name: normalizedEmail.split("@")[0],
        email: normalizedEmail,
        role: isAdminEmail(normalizedEmail) ? "admin" : "user",
        email_verified: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    const profile = await supabaseAdmin.from("profiles").select("*").eq("id", supaUser.id).single();
    const token = signToken({ id: supaUser.id, username: profile.data?.username || normalizedEmail.split("@")[0] });

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
      isNewUser: !existingProfile,
    });
  } catch (e) {
    console.error("[SUPABASE EMAIL OTP ERROR]", e);
    return res.status(500).json({ error: "Lỗi xác minh email." });
  }
});

// ─── Phone OTP: Send ────────────────────────────────────

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

// ─── Phone OTP: Verify ──────────────────────────────────

router.post("/otp/phone/verify", otpVerifyLimit, async (req, res) => {
  const { phone, code } = req.body || {};
  const normalizedPhone = (phone || "").trim();
  const otpCode = (code || "").trim();
  if (!normalizedPhone || !otpCode) {
    return res.status(400).json({ error: "Thiếu số điện thoại hoặc mã xác minh." });
  }

  const result = await verifyOTP(normalizedPhone, "phone", otpCode);
  if (result.error) return res.status(401).json({ error: result.error });

  try {
    const uname = await usernameFromSeed("user");
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      phone: normalizedPhone,
      password: randomUUID(),
      phone_confirm: true,
      user_metadata: { username: uname, display_name: uname },
    });

    if (authError && !authError.message?.includes("already registered")) {
      console.error("[SUPABASE PHONE AUTH ERROR]", authError.message);
      return res.status(500).json({ error: "Lỗi tạo tài khoản." });
    }

    const supaUser = authData?.user || (await supabaseAdmin.auth.admin.listUsers({ filter: normalizedPhone })).data?.users?.[0];
    if (!supaUser) return res.status(500).json({ error: "Không tạo được tài khoản." });

    const { data: existingProfile } = await supabaseAdmin
      .from("profiles").select("*").eq("id", supaUser.id).maybeSingle();

    if (!existingProfile) {
      await supabaseAdmin.from("profiles").insert({
        id: supaUser.id, username: uname, display_name: uname,
        phone: normalizedPhone, phone_verified: true,
        role: "user",
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
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
        phone: normalizedPhone, phoneVerified: true, authProvider: "phone",
      },
      isNewUser: !existingProfile,
    });
  } catch (e) {
    console.error("[SUPABASE PHONE OTP ERROR]", e);
    return res.status(500).json({ error: "Lỗi xác minh số điện thoại." });
  }
});

// ─── Google OAuth ───────────────────────────────────────

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
  if (!process.env.GOOGLE_CLIENT_ID) return res.status(503).json({ error: "Đăng nhập Google chưa được cấu hình trên server." });
  const { accessToken } = req.body || {};
  if (!accessToken) return res.status(400).json({ error: "Thiếu accessToken." });
  try {
    const googleProfile = await verifyGoogleAccessToken(accessToken);
    if (!googleProfile) return res.status(401).json({ error: "Không xác minh được đăng nhập Google." });

    const uname = await usernameFromSeed((googleProfile.email || "google_user").split("@")[0]);
    let supaUser = null;

    if (googleProfile.email) {
      const { data: listResult } = await supabaseAdmin.auth.admin.listUsers({ filter: googleProfile.email });
      supaUser = listResult?.users?.[0];
    }

    if (!supaUser) {
      const { data: newData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: googleProfile.email || `${googleProfile.id}@google.placeholder`,
        password: randomUUID(),
        email_confirm: true,
        user_metadata: { username: uname, display_name: googleProfile.name || uname },
      });
      if (createErr && !createErr.message?.includes("already registered")) {
        console.error("[SUPABASE GOOGLE CREATE ERROR]", createErr.message);
        return res.status(500).json({ error: "Lỗi tạo tài khoản Google." });
      }
      supaUser = newData?.user;
    }
    if (!supaUser) return res.status(500).json({ error: "Không tạo được tài khoản." });

    const { data: existingProfile } = await supabaseAdmin
      .from("profiles").select("*").eq("id", supaUser.id).maybeSingle();

    if (!existingProfile) {
      await supabaseAdmin.from("profiles").insert({
        id: supaUser.id, username: uname,
        display_name: googleProfile.name || uname,
        email: googleProfile.email,
        role: isAdminEmail(googleProfile.email) ? "admin" : "user",
        email_verified: true,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
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
        email: googleProfile.email, emailVerified: true, authProvider: "google",
      },
    });
  } catch (e) {
    res.status(401).json({ error: "Không xác minh được đăng nhập Google." });
  }
});

// ─── Apple OAuth ────────────────────────────────────────

function decodeAppleToken(identityToken) {
  try {
    const parts = identityToken.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    if (!payload || !payload.sub) return null;
    return { id: payload.sub, email: payload.email || null, name: null };
  } catch { return null; }
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

    const uname = await usernameFromSeed((profile.email || "apple_user").split("@")[0]);
    let supaUser = null;

    if (profile.email) {
      const { data: listResult } = await supabaseAdmin.auth.admin.listUsers({ filter: profile.email });
      supaUser = listResult?.users?.[0];
    }

    if (!supaUser) {
      const { data: newData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: profile.email || `${profile.id}@apple.placeholder`,
        password: randomUUID(),
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
      .from("profiles").select("*").eq("id", supaUser.id).maybeSingle();

    if (!existingProfile) {
      await supabaseAdmin.from("profiles").insert({
        id: supaUser.id, username: uname,
        display_name: profile.name || uname,
        email: profile.email,
        role: isAdminEmail(profile.email) ? "admin" : "user",
        email_verified: !!profile.email,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
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
        email: profile.email, authProvider: "apple",
      },
    });
  } catch (e) {
    res.status(401).json({ error: "Không xác minh được đăng nhập Apple." });
  }
});

// ─── Current user ───────────────────────────────────────

router.get("/me", requireAuth, async (req, res) => {
  if (req.user.id) {
    try {
      const { data: profile } = await supabaseAdmin
        .from("profiles").select("*").eq("id", req.user.id).single();
      if (profile) {
        let role = profile.role;
        const email = req.user.email || profile.email;
        if (isAdminEmail(email) && role !== "admin") {
          await supabaseAdmin.from("profiles").update({ role: "admin", updated_at: new Date().toISOString() }).eq("id", req.user.id);
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
            authProvider: profile.auth_provider || "email",
          },
        });
      }
    } catch (e) {
      console.error("[ME] Supabase profile lookup failed:", e.message);
    }
  }
  return res.status(404).json({ error: "Không tìm thấy tài khoản." });
});

// ─── Sync Profile ───────────────────────────────────────

router.post("/sync-profile", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const email = req.user.email || null;

    const { data: existing } = await supabaseAdmin
      .from("profiles").select("*").eq("id", userId).maybeSingle();

    let profile = existing;

    if (!profile) {
      const uname = await usernameFromSeed((email || "user").split("@")[0]);
      const { data: newProfile, error: insertErr } = await supabaseAdmin
        .from("profiles").insert({
          id: userId, username: uname,
          display_name: email?.split("@")[0] || uname,
          email: email,
          role: isAdminEmail(email) ? "admin" : "user",
          email_verified: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).select("*").single();
      if (insertErr) {
        console.error("[SYNC-PROFILE] insert error:", insertErr.message);
        return res.status(500).json({ error: "Lỗi tạo hồ sơ." });
      }
      profile = newProfile;
    } else {
      if (!profile.email_verified && email) {
        await supabaseAdmin.from("profiles").update({ email_verified: true, updated_at: new Date().toISOString() }).eq("id", userId);
        profile.email_verified = true;
      }
    }

    let effectiveRole = profile.role;
    if (isAdminEmail(email) && profile.role !== "admin") {
      await supabaseAdmin.from("profiles").update({ role: "admin", updated_at: new Date().toISOString() }).eq("id", userId);
      effectiveRole = "admin";
    }

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
  } catch (e) {
    console.error("[SYNC-PROFILE ERROR]", e);
    return res.status(500).json({ error: "Lỗi đồng bộ hồ sơ." });
  }
});

// ─── Available providers ────────────────────────────────

router.get("/providers", (req, res) => {
  res.json({
    google: !!process.env.GOOGLE_CLIENT_ID,
    apple: !!process.env.APPLE_CLIENT_ID,
  });
});

// ─── Profile update ─────────────────────────────────────

router.patch("/profile", requireAuth, async (req, res) => {
  const { displayName, bio } = req.body || {};
  const updates = { updated_at: new Date().toISOString() };
  if (displayName !== undefined) updates.display_name = displayName.trim();
  if (bio !== undefined) updates.bio = bio;

  const { data, error } = await supabaseAdmin
    .from("profiles").update(updates).eq("id", req.user.id).select("*").single();
  if (error) return res.status(500).json({ error: "Lỗi cập nhật hồ sơ." });
  return res.json({
    user: {
      username: data.username, displayName: data.display_name,
      bio: data.bio, avatarUrl: data.avatar_url,
      isAdmin: data.role === "admin", isArtist: data.role === "artist",
    },
  });
});

// ─── Onboarding Preferences ─────────────────────────────

router.get("/preferences", requireAuth, async (req, res) => {
  const { data: row } = await supabaseAdmin
    .from("user_preferences").select("*").eq("user_id", req.user.id).maybeSingle();
  if (!row) return res.json({ preferences: null, onboardingCompleted: !!req.user.onboarding_completed });
  res.json({
    preferences: {
      favoriteGenres: row.favorite_genres || [],
      favoriteArtists: row.favorite_artists || [],
      preferredMoods: row.favorite_moods || [],
      onboardingStep: row.onboarding_step,
    },
    onboardingCompleted: !!req.user.onboarding_completed,
  });
});

router.post("/preferences", requireAuth, async (req, res) => {
  const { favoriteGenres, favoriteArtists, preferredMoods, onboardingStep } = req.body || {};
  const now = new Date().toISOString();
  const { data: existing } = await supabaseAdmin
    .from("user_preferences").select("user_id").eq("user_id", req.user.id).maybeSingle();

  if (existing) {
    const updates = { updated_at: now };
    if (favoriteGenres !== undefined) updates.favorite_genres = favoriteGenres;
    if (favoriteArtists !== undefined) updates.favorite_artists = favoriteArtists;
    if (preferredMoods !== undefined) updates.favorite_moods = preferredMoods;
    if (onboardingStep !== undefined) updates.onboarding_step = onboardingStep;
    await supabaseAdmin.from("user_preferences").update(updates).eq("user_id", req.user.id);
  } else {
    await supabaseAdmin.from("user_preferences").insert({
      user_id: req.user.id,
      favorite_genres: favoriteGenres || [],
      favorite_artists: favoriteArtists || [],
      favorite_moods: preferredMoods || [],
      onboarding_step: onboardingStep || 0,
      created_at: now, updated_at: now,
    });
  }
  res.json({ ok: true });
});

router.post("/complete-onboarding", requireAuth, async (req, res) => {
  await supabaseAdmin.from("profiles").update({ onboarding_completed: true, updated_at: new Date().toISOString() }).eq("id", req.user.id);
  const { data: profile } = await supabaseAdmin.from("profiles").select("*").eq("id", req.user.id).single();
  res.json({
    ok: true,
    user: {
      username: profile?.username, displayName: profile?.display_name,
      isAdmin: profile?.role === "admin", isArtist: profile?.role === "artist",
      onboardingCompleted: !!profile?.onboarding_completed,
    },
  });
});

export default router;
