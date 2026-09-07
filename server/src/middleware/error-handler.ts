/**
 * 4ang Global Error Handler Middleware
 *
 * Catches unhandled errors and returns standardized responses.
 */

import type { Request, Response, NextFunction } from "express";
import { sendError } from "../errors/error-response.js";

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  const requestId = req.requestId || "unknown";

  // Log error
  console.error(`[error] ${requestId} ${req.method} ${req.path}:`, err.message);

  sendError(res, err, requestId);
}
