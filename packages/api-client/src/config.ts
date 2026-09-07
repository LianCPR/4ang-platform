/**
 * 4ang API Client Configuration
 */

export interface ApiClientConfig {
  baseUrl: string;
  timeout: number;
  headers: Record<string, string>;
}

const DEFAULT_CONFIG: ApiClientConfig = {
  baseUrl: import.meta.env?.VITE_API_URL || "",
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
};

let config: ApiClientConfig = { ...DEFAULT_CONFIG };

export function configure(newConfig: Partial<ApiClientConfig>): void {
  config = { ...config, ...newConfig };
}

export function getConfig(): ApiClientConfig {
  return { ...config };
}

export function setAuthToken(token: string | null): void {
  if (token) {
    config.headers["Authorization"] = `Bearer ${token}`;
  } else {
    delete config.headers["Authorization"];
  }
}
