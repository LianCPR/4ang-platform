/**
 * 4ang Security Headers Middleware
 *
 * Adds production-appropriate security headers.
 */

export function securityHeaders(req, res, next) {
  // Prevent MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");

  // Prevent clickjacking
  res.setHeader("X-Frame-Options", "DENY");

  // Referrer policy
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // Permissions policy — restrict browser features
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  // HSTS — enforce HTTPS (only in production)
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  next();
}
