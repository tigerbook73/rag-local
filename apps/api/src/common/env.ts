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

/** Returns the API key for the given LLM provider, or throws if not configured. */
export function getLlmApiKey(provider: string): string {
  const keyMap: Record<string, string | undefined> = {
    openai: process.env["OPENAI_API_KEY"],
    deepseek: process.env["DEEPSEEK_API_KEY"],
  };
  const key = keyMap[provider];
  if (!key)
    throw new Error(
      `Missing env var for LLM provider "${provider}" — set ${provider.toUpperCase()}_API_KEY`,
    );
  return key;
}
