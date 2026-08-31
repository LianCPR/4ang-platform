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

  // Supabase Auth token
  if (USE_SUPABASE && isSupabaseToken(token)) {
    try {
      const supabaseUser = await verifyToken(token);
      if (!supabaseUser) {
        return res.status(401).json({ error: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn." });
      }
      const profile = await getProfile(supabaseUser.id);
      if (!profile) {
        return res.status(401).json({ error: "Tài khoản không tồn tại." });
      }
      if (profile.is_restricted) {
        return res.status(403).json({ error: "Tài khoản của bạn đã bị hạn chế." });
      }
      req.user = {
        id: supabaseUser.id,
        username: profile.username,
        email: supabaseUser.email,
        isAdmin: profile.role === "admin",
        isArtist: profile.role === "artist",
        profile,
      };
      return next();
    } catch (e) {
      return res.status(401).json({ error: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn." });
    }
  }

  // Fallback to legacy JWT (for migration period)
  if (!USE_SUPABASE) {
    try {
      req.user = jwt.verify(token, JWT_SECRET);
      return next();
    } catch (e) {
      return res.status(401).json({ error: "Phiên đăng nhập không hợp lệ." });
    }
  }

  return res.status(401).json({ error: "Phiên đăng nhập không hợp lệ." });
}

export function optionalAuth(req, res, next) {
  const token = extractToken(req);
  if (token && USE_SUPABASE && isSupabaseToken(token)) {
    verifyToken(token).then((user) => {
      if (user) {
        getProfile(user.id).then((profile) => {
          if (profile) {
            req.user = {
              id: user.id,
              username: profile.username,
              email: user.email,
              isAdmin: profile.role === "admin",
              isArtist: profile.role === "artist",
              profile,
            };
          }
          next();
        }).catch(() => next());
      } else {
        next();
      }
    }).catch(() => next());
  } else {
    next();
  }
}

export function requireAdmin(req, res, next) {
  if (!req.user || !req.user.isAdmin) return res.status(403).json({ error: "Chỉ admin mới thực hiện được việc này." });
  next();
}

export function requireArtist(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Chưa đăng nhập." });
  if (!req.user.isArtist && !req.user.isAdmin) return res.status(403).json({ error: "Chỉ nghệ sĩ mới thực hiện được việc này." });
  next();
}
