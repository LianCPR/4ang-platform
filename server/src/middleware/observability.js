/**
 * 4ang Structured Logging Middleware
 *
 * Provides:
 * - Request ID generation/preservation
 * - Structured request/response logging
 * - Duration tracking
 * - Safe log output (no secrets)
 */

import crypto from "crypto";

// Simple request ID generator
function generateRequestId() {
  return crypto.randomUUID?.() || `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Request ID middleware — generates or preserves X-Request-ID
 */
export function requestIdMiddleware(req, res, next) {
  const clientProvided = req.headers["x-request-id"];
  // Only accept alphanumeric + hyphens, max 128 chars
  const sanitized = typeof clientProvided === "string"
    ? clientProvided.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 128)
    : null;

  req.requestId = sanitized || generateRequestId();
  res.setHeader("X-Request-ID", req.requestId);
  next();
}

/**
 * Structured request logging middleware
 * Logs: method, path, status, duration, requestId
 */
export function requestLogger(req, res, next) {
  const start = Date.now();

  // Capture original end to log after response
  const originalEnd = res.end;
  res.end = function (...args) {
    const durationMs = Date.now() - start;
    const level = res.statusCode >= 500 ? "ERROR" : res.statusCode >= 400 ? "WARN" : "INFO";

    // Never log authorization headers or tokens
    const safeHeaders = {};
    const unsafeHeaders = ["authorization", "cookie", "x-api-key", "x-supabase"];
    for (const [k, v] of Object.entries(req.headers || {})) {
      if (!unsafeHeaders.includes(k.toLowerCase())) {
        safeHeaders[k] = v;
      }
    }

    const logEntry = {
      level,
      time: new Date().toISOString(),
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs,
      ip: req.ip || "unknown",
      ua: (req.headers["user-agent"] || "unknown").slice(0, 100),
    };

    // Add userId for authenticated requests
    if (req.user?.id) {
      logEntry.userId = req.user.id;
    }

    // Only log errors/warns with more detail
    if (level !== "INFO") {
      logEntry.query = req.query;
      if (res.statusCode >= 500) {
        logEntry.error = res.statusMessage || "Internal Server Error";
      }
    }

    const logLine = JSON.stringify(logEntry);

    if (level === "ERROR") {
      console.error(logLine);
    } else if (level === "WARN") {
      console.warn(logLine);
    } else {
      console.log(logLine);
    }

    originalEnd.apply(res, args);
  };

  next();
}
