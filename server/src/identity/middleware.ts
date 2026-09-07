/**
 * 4ang Identity Middleware
 *
 * Centralized authentication and authorization.
 * Builds typed IdentityContext for every authenticated request.
 */

import type { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../supabase.js";
import type { IdentityContext, UserRole, Permission } from "./types.js";
import { buildIdentityContext, hasPermission } from "./types.js";

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      identity?: IdentityContext;
    }
  }
}

/**
 * Optional auth — attaches identity if token present, but doesn't block.
 */
export function optionalIdentity(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return next();
  }

  const token = authHeader.slice(7);
  supabaseAdmin.auth.getUser(token).then(({ data: { user } }) => {
    if (!user) return next();

    supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single()
      .then(({ data: profile }) => {
        if (profile) {
          req.identity = buildIdentityContext(profile);
        }
        next();
      })
      .catch(() => next());
  }).catch(() => next());
}

/**
 * Require authentication — blocks if no valid token.
 * Attaches typed IdentityContext to req.identity.
 */
export function requireIdentity(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Chưa đăng nhập." });
  }

  const token = authHeader.slice(7);
  supabaseAdmin.auth.getUser(token).then(async ({ data: { user }, error }) => {
    if (error || !user) {
      return res.status(401).json({ error: "Token không hợp lệ." });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return res.status(401).json({ error: "Profile không tồn tại." });
    }

    if (profile.is_restricted) {
      return res.status(403).json({ error: "Tài khoản bị hạn chế." });
    }

    req.identity = buildIdentityContext(profile);
    next();
  }).catch(() => {
    res.status(401).json({ error: "Lỗi xác thực." });
  });
}

/**
 * Require specific role.
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.identity) {
      return res.status(401).json({ error: "Chưa đăng nhập." });
    }
    if (!roles.includes(req.identity.role)) {
      return res.status(403).json({ error: "Không có quyền truy cập." });
    }
    next();
  };
}

/**
 * Require specific permission.
 */
export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.identity) {
      return res.status(401).json({ error: "Chưa đăng nhập." });
    }
    if (!hasPermission(req.identity.role, permission)) {
      return res.status(403).json({ error: `Không có quyền: ${permission}` });
    }
    next();
  };
}

/**
 * Require admin role.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.identity?.isAdmin) {
    return res.status(403).json({ error: "Chỉ admin mới thực hiện được việc này." });
  }
  next();
}

/**
 * Require artist role (or verified_artist).
 */
export function requireArtist(req: Request, res: Response, next: NextFunction): void {
  if (!req.identity?.isArtist && !req.identity?.isAdmin) {
    return res.status(403).json({ error: "Chỉ nghệ sĩ mới thực hiện được việc này." });
  }
  next();
}
