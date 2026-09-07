/**
 * 4ang Core API Client
 *
 * Typed HTTP client for all API requests.
 * Replaces scattered fetch() calls throughout the application.
 */

import { getConfig } from "./config";
import { ApiError, NetworkError, TimeoutError } from "./errors";

export interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  timeout?: number;
  signal?: AbortSignal;
}

export interface ApiResponse<T> {
  data: T;
  status: number;
}

/**
 * Make a typed API request.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const config = getConfig();
  const url = `${config.baseUrl}/api${path}`;

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeout || config.timeout
  );

  try {
    const res = await fetch(url, {
      method: options.method || "GET",
      headers: {
        ...config.headers,
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: options.signal || controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      let errorBody: unknown;
      try {
        errorBody = await res.json();
      } catch {
        errorBody = await res.text().catch(() => null);
      }

      const message =
        (errorBody as Record<string, string>)?.error ||
        (errorBody as Record<string, string>)?.message ||
        `Request failed (${res.status})`;

      throw new ApiError(res.status, message, (errorBody as Record<string, string>)?.code, errorBody);
    }

    // Handle empty responses
    const contentType = res.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      return await res.json();
    }
    return (await res.text()) as T;
  } catch (error) {
    clearTimeout(timeout);

    if (error instanceof ApiError) throw error;

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new TimeoutError("Request timed out");
    }

    if (error instanceof TypeError) {
      throw new NetworkError("Network request failed");
    }

    throw error;
  }
}

/**
 * Upload a file via multipart/form-data.
 */
export async function upload<T>(path: string, formData: FormData): Promise<T> {
  const config = getConfig();
  const url = `${config.baseUrl}/api${path}`;

  // Don't set Content-Type for FormData — browser sets it with boundary
  const headers: Record<string, string> = {};
  if (config.headers["Authorization"]) {
    headers["Authorization"] = config.headers["Authorization"];
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new ApiError(res.status, errorBody.error || "Upload failed", errorBody.code, errorBody);
  }

  return await res.json();
}
