/**
 * 4ang Input Validation Middleware
 *
 * Validates request parameters, query strings, and body.
 * Returns structured error responses.
 */

/**
 * Validate that required query params exist.
 * @param {string[]} params - Required query parameter names
 */
export function requireQueryParams(...params) {
  return (req, res, next) => {
    const missing = params.filter(p => !req.query[p]);
    if (missing.length > 0) {
      return res.status(400).json({
        error: `Missing required query parameters: ${missing.join(", ")}`,
      });
    }
    next();
  };
}

/**
 * Validate UUID format (prevents injection via IDs).
 * @param {string} paramName - Name of the parameter to validate
 * @param {"query"|"params"} source - Where to find it
 */
export function requireUUID(paramName, source = "params") {
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return (req, res, next) => {
    const value = source === "query" ? req.query[paramName] : req.params[paramName];
    if (value && !UUID_REGEX.test(String(value))) {
      return res.status(400).json({ error: `Invalid ${paramName} format` });
    }
    next();
  };
}

/**
 * Validate string length.
 * @param {string} fieldName - Body field name
 * @param {number} max - Maximum length
 * @param {number} min - Minimum length (default 0)
 */
export function maxLength(fieldName, max, min = 0) {
  return (req, res, next) => {
    const value = req.body?.[fieldName];
    if (value === undefined || value === null) return next();
    if (typeof value !== "string") return next();
    if (value.length > max) {
      return res.status(400).json({ error: `${fieldName} exceeds maximum length of ${max}` });
    }
    if (min > 0 && value.trim().length < min) {
      return res.status(400).json({ error: `${fieldName} must be at least ${min} characters` });
    }
    next();
  };
}

/**
 * Sanitize user-provided text to prevent XSS in stored data.
 * This is a basic text sanitizer — for HTML output use a proper library.
 * @param {string} fieldName - Body field name
 */
export function sanitizeText(fieldName) {
  return (req, res, next) => {
    if (req.body?.[fieldName] && typeof req.body[fieldName] === "string") {
      // Remove null bytes, script tags, and control characters
      req.body[fieldName] = req.body[fieldName]
        .replace(/\0/g, "")
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "[removed]")
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
        .slice(0, 5000); // Hard limit
    }
    next();
  };
}

/**
 * Validate integer within range.
 * @param {string} paramName - Query or body parameter name
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @param {"query"|"body"} source
 */
export function requireInteger(paramName, min, max, source = "query") {
  return (req, res, next) => {
    const value = source === "query" ? req.query[paramName] : req.body?.[paramName];
    if (value === undefined || value === null) return next();
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
      return res.status(400).json({ error: `${paramName} must be an integer between ${min} and ${max}` });
    }
    // Coerce to number
    if (source === "query") {
      req.query[paramName] = parsed;
    } else {
      req.body[paramName] = parsed;
    }
    next();
  };
}

/**
 * Validate array size limit.
 * @param {string} fieldName - Body field name
 * @param {number} maxItems - Maximum array size
 */
export function maxArraySize(fieldName, maxItems) {
  return (req, res, next) => {
    const value = req.body?.[fieldName];
    if (Array.isArray(value) && value.length > maxItems) {
      return res.status(400).json({ error: `${fieldName} exceeds maximum size of ${maxItems}` });
    }
    next();
  };
}
