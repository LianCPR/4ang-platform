/**
 * 4ang Validation Middleware
 *
 * Lightweight input validation.
 * Validates request params, query, and body.
 */

import type { Request, Response, NextFunction } from "express";
import { validationError } from "../errors/AppError.js";

type ValidationSchema = Record<string, {
  type?: "string" | "number" | "boolean" | "array" | "object";
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: RegExp;
  enum?: unknown[];
  custom?: (value: unknown) => boolean;
  message?: string;
}>;

function validateValue(value: unknown, schema: { type?: string; min?: number; max?: number; pattern?: RegExp; enum?: unknown[]; custom?: (v: unknown) => boolean; message?: string }): string | null {
  if (value === undefined || value === null) return null; // Handle required separately

  if (schema.custom && !schema.custom(value)) {
    return schema.message || "Invalid value";
  }

  if (schema.enum && !schema.enum.includes(value)) {
    return schema.message || `Must be one of: ${schema.enum.join(", ")}`;
  }

  if (schema.type === "string" && typeof value === "string") {
    if (schema.min !== undefined && value.length < schema.min) return `Minimum ${schema.min} characters`;
    if (schema.max !== undefined && value.length > schema.max) return `Maximum ${schema.max} characters`;
    if (schema.pattern && !schema.pattern.test(value)) return schema.message || "Invalid format";
  }

  if (schema.type === "number" && typeof value === "number") {
    if (schema.min !== undefined && value < schema.min) return `Minimum value is ${schema.min}`;
    if (schema.max !== undefined && value > schema.max) return `Maximum value is ${schema.max}`;
  }

  if (schema.type === "array" && !Array.isArray(value)) {
    return "Must be an array";
  }

  return null;
}

export function validate(schema: ValidationSchema, source: "params" | "query" | "body" = "body") {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const data = req[source];
    const errors: Record<string, string> = {};

    for (const [field, fieldSchema] of Object.entries(schema)) {
      const value = data[field];

      if (fieldSchema.required && (value === undefined || value === null || value === "")) {
        errors[field] = fieldSchema.message || `${field} is required`;
        continue;
      }

      if (value !== undefined && value !== null) {
        const error = validateValue(value, fieldSchema);
        if (error) errors[field] = error;
      }
    }

    if (Object.keys(errors).length > 0) {
      next(validationError("Validation failed", errors, req.requestId));
      return;
    }

    next();
  };
}
