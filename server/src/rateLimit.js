// Minimal in-memory fixed-window rate limiter — no extra dependency.
// In-memory window is real protection for a single-process server.
// Applied only to sensitive endpoints — login, admin actions, submission
// writes — never blanket-applied to reads.

const buckets = new Map();

// Periodic sweep so the map never grows unbounded across a long-running
// process.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart > 10 * 60 * 1000) buckets.delete(key);
  }
}, 5 * 60 * 1000).unref?.();

export function rateLimit({ windowMs = 60_000, max = 20, keyPrefix = "rl" } = {}) {
  return (req, res, next) => {
    const ip = req.ip || req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown";
    const key = keyPrefix + ":" + ip;
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || now - bucket.windowStart > windowMs) {
      bucket = { windowStart: now, count: 0 };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > max) {
      const retryAfterSec = Math.ceil((bucket.windowStart + windowMs - now) / 1000);
      res.set("Retry-After", String(Math.max(1, retryAfterSec)));
      return res.status(429).json({ error: "Quá nhiều yêu cầu, vui lòng thử lại sau ít phút." });
    }
    next();
  };
}
