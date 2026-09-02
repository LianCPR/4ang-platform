import jwt from "jsonwebtoken";
import { verifyToken, getProfile } from "./supabase.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-only-secret-change-me";
const USE_SUPABASE = !!process.env.SUPABASE_URL;

export const usingDefaultSecret = !process.env.JWT_SECRET;

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

function extractToken(req) {
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) return header.slice(7);
  if (req.query && req.query.token) return req.query.token;
  return null;
}

function isSupabaseToken(token) {
  return token && token.startsWith("eyJ") && token.split(".").length === 3;
}

export async function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: "Chưa đăng nhập." });

  // 1) Try Supabase Auth first (if configured)
  if (USE_SUPABASE && isSupabaseToken(token)) {
    try {
      const supabaseUser = await verifyToken(token);
      if (supabaseUser) {
        const profile = await getProfile(supabaseUser.id);
        if (profile) {
          if (profile.is_restricted) {
            return res.status(403).json({ error: "Tài khoản của bạn đã bị hạn chế." });
          }
          // Check ADMIN_EMAILS for admin role (covers profiles created before ADMIN_EMAILS was configured)
          const adminEmails = (process.env.ADMIN_EMAILS || "")
            .split(",")
            .map((e) => e.trim().toLowerCase())
            .filter(Boolean);
          const emailIsAdmin = supabaseUser.email && adminEmails.includes(supabaseUser.email.toLowerCase());
          req.user = {
            id: supabaseUser.id,
            username: profile.username,
            email: supabaseUser.email,
            isAdmin: profile.role === "admin" || emailIsAdmin,
            isArtist: profile.role === "artist",
            profile,
          };
          return next();
        }
        // Supabase user exists but no profile — fall through to legacy
      }
    } catch (e) {
      // Supabase verification failed — likely a legacy JWT, fall through
    }
  }

  // 2) Fallback to legacy JWT (also handles backend JWTs issued by sync-profile for Supabase users)
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    let email = decoded.email || null;
    let isAdmin = !!decoded.is_admin || !!decoded.isAdmin;
    let isArtist = !!decoded.is_artist || !!decoded.isArtist;
    let profile = null;

    // Try SQLite first
    if (decoded.username) {
      try {
        const { db } = await import("./db.js");
        const u = db.prepare("SELECT email, is_admin FROM users WHERE username = ?").get(decoded.username);
        if (u) { email = u.email || email; isAdmin = !!u.is_admin || isAdmin; }
      } catch { /* ignore */ }
    }

    // If user not found in SQLite but Supabase is configured, try Supabase profile
    // This covers backend JWTs issued by sync-profile for Supabase-only users
    if (USE_SUPABASE && decoded.id && !email) {
      try {
        profile = await getProfile(decoded.id);
        if (profile) {
          email = profile.email || null;
          // Check ADMIN_EMAILS for these users too
          const adminEmails = (process.env.ADMIN_EMAILS || "")
            .split(",")
            .map((e) => e.trim().toLowerCase())
            .filter(Boolean);
          const emailIsAdmin = email && adminEmails.includes(email.toLowerCase());
          isAdmin = profile.role === "admin" || emailIsAdmin;
          isArtist = profile.role === "artist";
        }
      } catch { /* ignore */ }
    }

    req.user = {
      ...decoded,
      email,
      isAdmin,
      isArtist,
    };
    return next();
  } catch (e) {
    return res.status(401).json({ error: "Phiên đăng nhập không hợp lệ." });
  }
}

export async function optionalAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) return next();

  // 1) Try Supabase first
  if (USE_SUPABASE && isSupabaseToken(token)) {
    try {
      const supabaseUser = await verifyToken(token);
      if (supabaseUser) {
        const profile = await getProfile(supabaseUser.id);
        if (profile) {
          // Check ADMIN_EMAILS for admin role (covers profiles created before ADMIN_EMAILS was configured)
          const adminEmails = (process.env.ADMIN_EMAILS || "")
            .split(",")
            .map((e) => e.trim().toLowerCase())
            .filter(Boolean);
          const emailIsAdmin = supabaseUser.email && adminEmails.includes(supabaseUser.email.toLowerCase());
          req.user = {
            id: supabaseUser.id,
            username: profile.username,
            email: supabaseUser.email,
            isAdmin: profile.role === "admin" || emailIsAdmin,
            isArtist: profile.role === "artist",
            profile,
          };
          return next();
        }
      }
    } catch (e) {
      // Supabase failed — fall through to legacy
    }
  }

  // 2) Fallback to legacy JWT (also handles backend JWTs issued by sync-profile for Supabase users)
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    let email = decoded.email || null;
    let isAdmin = !!decoded.is_admin || !!decoded.isAdmin;
    let isArtist = !!decoded.is_artist || !!decoded.isArtist;

    if (decoded.username) {
      try {
        const { db } = await import("./db.js");
        const u = db.prepare("SELECT email, is_admin FROM users WHERE username = ?").get(decoded.username);
        if (u) { email = u.email || email; isAdmin = !!u.is_admin || isAdmin; }
      } catch { /* ignore */ }
    }

    if (USE_SUPABASE && decoded.id && !email) {
      try {
        const profile = await getProfile(decoded.id);
        if (profile) {
          email = profile.email || null;
          const adminEmails = (process.env.ADMIN_EMAILS || "")
            .split(",")
            .map((e) => e.trim().toLowerCase())
            .filter(Boolean);
          const emailIsAdmin = email && adminEmails.includes(email.toLowerCase());
          isAdmin = profile.role === "admin" || emailIsAdmin;
          isArtist = profile.role === "artist";
        }
      } catch { /* ignore */ }
    }

    req.user = {
      ...decoded,
      email,
      isAdmin,
      isArtist,
    };
  } catch (e) {
    // invalid token — continue without auth
  }
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Chưa đăng nhập." });
  // Check both the profile role AND the ADMIN_EMAILS env var (safety fallback)
  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const emailIsAdmin = req.user.email && adminEmails.includes(req.user.email.toLowerCase());
  if (!req.user.isAdmin && !emailIsAdmin) {
    return res.status(403).json({ error: "Chỉ admin mới thực hiện được việc này." });
  }
  next();
}

export function requireArtist(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Chưa đăng nhập." });
  if (!req.user.isArtist && !req.user.isAdmin) return res.status(403).json({ error: "Chỉ nghệ sĩ mới thực hiện được việc này." });
  next();
}
