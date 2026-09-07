/**
 * 4ang Error Response Formatter
 *
 * Standardized API error responses.
 */

import type { Request, Response } from "express";
import { AppError } from "./AppError.js";

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

export function sendError(res: Response, error: unknown, requestId?: string): void {
  if (error instanceof AppError) {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        requestId: requestId || error.requestId,
      },
    };
    if (error.details) {
      response.error.details = error.details;
    }
    res.status(error.statusCode).json(response);
    return;
  }

  // Unknown error — don't leak internals
  console.error("[error-response]", error);
  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message: "Internal server error",
      requestId,
    },
  });
}
