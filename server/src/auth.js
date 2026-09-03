/**
 * 4ANG Auth Middleware — Supabase PostgreSQL only.
 *
 * Verifies Supabase JWT tokens and backend JWTs, resolves user identity,
 * and sets req.user with id, username, email, isAdmin, isArtist.
 */
import jwt from "jsonwebtoken";
import { verifyToken, getProfile } from "./supabase.js";
import { supabaseAdmin } from "./supabase.js";

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

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
}

function isAdminEmail(email) {
  if (!email) return false;
  return getAdminEmails().includes(email.toLowerCase());
}

async function resolveSupabaseUser(token) {
  try {
    const supabaseUser = await verifyToken(token);
    if (!supabaseUser) return null;

    const profile = await getProfile(supabaseUser.id);
    if (!profile) return null;

    if (profile.is_restricted) return { restricted: true };

    const emailIsAdmin = isAdminEmail(supabaseUser.email);
    return {
      id: supabaseUser.id,
      username: profile.username,
      email: supabaseUser.email || profile.email,
      isAdmin: profile.role === "admin" || emailIsAdmin,
      isArtist: profile.role === "artist",
      profile,
    };
  } catch {
    return null;
  }
}

export async function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: "Chưa đăng nhập." });

  // 1) Try Supabase Auth first
  if (USE_SUPABASE && isSupabaseToken(token)) {
    const user = await resolveSupabaseUser(token);
    if (user) {
      if (user.restricted) {
        return res.status(403).json({ error: "Tài khoản của bạn đã bị hạn chế." });
      }
      req.user = user;
      return next();
    }
  }

  // 2) Fallback to legacy/backend JWT
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    let email = decoded.email || null;
    let isAdmin = !!decoded.is_admin || !!decoded.isAdmin;
    let isArtist = !!decoded.is_artist || !!decoded.isArtist;
    let profile = null;

    // For Supabase users with backend JWT (from sync-profile), resolve via Supabase
    if (USE_SUPABASE && decoded.id) {
      profile = await getProfile(decoded.id);
      if (profile) {
        email = profile.email || email;
        const emailIsAdmin = isAdminEmail(email);
        isAdmin = profile.role === "admin" || emailIsAdmin;
        isArtist = profile.role === "artist";

        if (profile.is_restricted) {
          return res.status(403).json({ error: "Tài khoản của bạn đã bị hạn chế." });
        }

        req.user = {
          id: decoded.id,
          username: profile.username,
          email,
          isAdmin,
          isArtist,
          profile,
        };
        return next();
      }
    }

    req.user = { ...decoded, email, isAdmin, isArtist };
    return next();
  } catch {
    return res.status(401).json({ error: "Phiên đăng nhập không hợp lệ." });
  }
}

export async function optionalAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) return next();

  if (USE_SUPABASE && isSupabaseToken(token)) {
    const user = await resolveSupabaseUser(token);
    if (user && !user.restricted) {
      req.user = user;
    }
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    let email = decoded.email || null;
    let isAdmin = !!decoded.is_admin || !!decoded.isAdmin;
    let isArtist = !!decoded.is_artist || !!decoded.isArtist;

    if (USE_SUPABASE && decoded.id) {
      const profile = await getProfile(decoded.id);
      if (profile) {
        email = profile.email || email;
        const emailIsAdmin = isAdminEmail(email);
        isAdmin = profile.role === "admin" || emailIsAdmin;
        isArtist = profile.role === "artist";
      }
    }

    req.user = { ...decoded, email, isAdmin, isArtist };
  } catch {
    // invalid token — continue without auth
  }
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Chưa đăng nhập." });
  const emailIsAdmin = req.user.email && isAdminEmail(req.user.email);
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
