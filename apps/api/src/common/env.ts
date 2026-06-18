const REQUIRED_ENV_VARS = [
  "DATABASE_URL",
  "REDIS_URL",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_KEY",
] as const;

export function validateEnv(): void {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`[startup] Missing required environment variables: ${missing.join(", ")}`);
    process.exit(1);
  }
}
