/**
 * 4ang Environment Configuration
 *
 * Centralized, typed environment variables.
 * Validates required variables at startup.
 */

export interface EnvConfig {
  NODE_ENV: "development" | "production" | "test";
  PORT: number;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  JWT_SECRET: string;
  CORS_ORIGINS: string[];
  AI_PROVIDER: string;
  AI_MODEL: string;
  OPENAI_API_KEY: string;
  INTELLIGENCE_URL: string;
  AI_RATE_LIMIT: number;
  AI_DAILY_LIMIT: number;
}

function getEnv(key: string, fallback?: string): string {
  const value = process.env[key] || fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getEnvNumber(key: string, fallback: number): number {
  const value = process.env[key];
  if (!value) return fallback;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? fallback : parsed;
}

function getEnvBool(key: string, fallback: boolean): boolean {
  const value = process.env[key];
  if (!value) return fallback;
  return value === "true" || value === "1";
}

let _config: EnvConfig | null = null;

export function getConfig(): EnvConfig {
  if (_config) return _config;

  _config = {
    NODE_ENV: (process.env.NODE_ENV as EnvConfig["NODE_ENV"]) || "development",
    PORT: getEnvNumber("PORT", 3001),
    SUPABASE_URL: getEnv("SUPABASE_URL", ""),
    SUPABASE_ANON_KEY: getEnv("SUPABASE_ANON_KEY", ""),
    SUPABASE_SERVICE_ROLE_KEY: getEnv("SUPABASE_SERVICE_ROLE_KEY", ""),
    JWT_SECRET: getEnv("JWT_SECRET", "dev-secret-change-in-production"),
    CORS_ORIGINS: (process.env.CORS_ORIGINS || "*").split(",").map(s => s.trim()),
    AI_PROVIDER: getEnv("AI_PROVIDER", "openai"),
    AI_MODEL: getEnv("AI_MODEL", "gpt-4o-mini"),
    OPENAI_API_KEY: getEnv("OPENAI_API_KEY", ""),
    INTELLIGENCE_URL: getEnv("INTELLIGENCE_URL", "http://localhost:8001"),
    AI_RATE_LIMIT: getEnvNumber("AI_RATE_LIMIT", 10),
    AI_DAILY_LIMIT: getEnvNumber("AI_DAILY_LIMIT", 100),
  };

  return _config;
}

export function isProduction(): boolean {
  return getConfig().NODE_ENV === "production";
}

export function hasAI(): boolean {
  return !!getConfig().OPENAI_API_KEY;
}
