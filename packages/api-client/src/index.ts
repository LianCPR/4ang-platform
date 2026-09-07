/**
 * 4ang API Client — barrel export
 *
 * Centralized, typed API access for the entire application.
 */

export { request, upload } from "./client";
export { configure, getConfig, setAuthToken } from "./config";
export { ApiError, NetworkError, TimeoutError } from "./errors";

export { tracksApi } from "./tracks";
export { discoveryApi } from "./discovery";
export { socialApi } from "./social";
export { recommendationsApi } from "./recommendations";
export { assistantApi } from "./assistant";

// Re-export types for convenience
export type { RequestOptions, ApiResponse } from "./client";
export type { ApiClientConfig } from "./config";
