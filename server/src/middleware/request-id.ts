/**
 * 4ang Request ID Middleware
 *
 * Generates or preserves a unique request ID for tracing.
 */

import { randomUUID } from "crypto";
import type { Request, Response, NextFunction } from "express";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incomingId = req.headers["x-request-id"];
  const id = (typeof incomingId === "string" && incomingId.trim()) || randomUUID();

  req.requestId = id;
  res.setHeader("X-Request-ID", id);

  next();
}
