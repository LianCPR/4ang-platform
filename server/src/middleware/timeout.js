/**
 * 4ang Request Timeout Middleware
 *
 * Prevents requests from hanging indefinitely.
 * Configurable per-route or global.
 */

/**
 * Request timeout middleware.
 * @param {number} ms - Timeout in milliseconds (default: 30s)
 * @param {string} message - Error message on timeout
 */
export function requestTimeout(ms = 30_000, message = "Request timed out") {
  return (req, res, next) => {
    // Skip if response already sent
    if (res.writableFinished) return next();

    const timer = setTimeout(() => {
      if (!res.writableFinished && !res.headersSent) {
        console.error(JSON.stringify({
          level: "WARN",
          time: new Date().toISOString(),
          requestId: req.requestId,
          event: "request_timeout",
          method: req.method,
          path: req.path,
          timeoutMs: ms,
        }));
        res.status(408).json({ error: message });
      }
    }, ms);

    // Clear timeout when response finishes
    res.on("finish", () => clearTimeout(timer));
    res.on("close", () => clearTimeout(timer));

    next();
  };
}
