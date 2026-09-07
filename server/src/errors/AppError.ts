/**
 * 4ang Application Error
 *
 * Typed, centralized error handling.
 * All API errors should use this class.
 */

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "DATABASE_ERROR"
  | "EXTERNAL_SERVICE_ERROR"
  | "INTERNAL_ERROR"
  | "BAD_REQUEST";

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: unknown;
  public readonly requestId?: string;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number = 500,
    details?: unknown,
    requestId?: string
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.requestId = requestId;
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      requestId: this.requestId,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// ERROR CONSTRUCTORS
// ═══════════════════════════════════════════════════════════════════

export function validationError(message: string, details?: unknown, requestId?: string): AppError {
  return new AppError("VALIDATION_ERROR", message, 400, details, requestId);
}

export function unauthorized(message = "Unauthorized", requestId?: string): AppError {
  return new AppError("UNAUTHORIZED", message, 401, undefined, requestId);
}

export function forbidden(message = "Forbidden", requestId?: string): AppError {
  return new AppError("FORBIDDEN", message, 403, undefined, requestId);
}

export function notFound(message = "Resource not found", requestId?: string): AppError {
  return new AppError("NOT_FOUND", message, 404, undefined, requestId);
}

export function conflict(message: string, requestId?: string): AppError {
  return new AppError("CONFLICT", message, 409, undefined, requestId);
}

export function rateLimited(message = "Rate limit exceeded", requestId?: string): AppError {
  return new AppError("RATE_LIMITED", message, 429, undefined, requestId);
}

export function databaseError(message: string, details?: unknown, requestId?: string): AppError {
  return new AppError("DATABASE_ERROR", message, 500, details, requestId);
}

export function externalServiceError(message: string, details?: unknown, requestId?: string): AppError {
  return new AppError("EXTERNAL_SERVICE_ERROR", message, 502, details, requestId);
}

export function internalError(message = "Internal server error", requestId?: string): AppError {
  return new AppError("INTERNAL_ERROR", message, 500, undefined, requestId);
}

export function badRequest(message: string, details?: unknown, requestId?: string): AppError {
  return new AppError("BAD_REQUEST", message, 400, details, requestId);
}
