import { defineConfig, devices } from "@playwright/test";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.test so globalSetup/Teardown can read DB/Storage credentials.
// In CI, env vars are expected to be injected directly — this is a no-op if the file is absent.
function loadTestEnv(): void {
  try {
    const content = readFileSync(resolve(import.meta.dirname, "../../.env.test"), "utf-8");
    for (const line of content.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq < 1) continue;
      const key = t.slice(0, eq).trim();
      let val = t.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
        val = val.slice(1, -1);
      // Don't override vars already set in the environment (CI secrets take precedence)
      process.env[key] ??= val;
    }
  } catch {
    // .env.test not found — relying on env vars from shell or CI
  }
}

loadTestEnv();

const isCI = !!process.env["CI"];
const TEST_API_PORT = process.env["TEST_API_PORT"] ?? "3001";
const TEST_WEB_PORT = process.env["TEST_WEB_PORT"] ?? "5173";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: "html",

  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",

  use: {
    baseURL: `http://localhost:${TEST_WEB_PORT}`,
    trace: "on-first-retry",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer: [
    {
      // WEB_PORT / API_PORT are injected for vite.config.ts to pick up
      command: `WEB_PORT=${TEST_WEB_PORT} API_PORT=${TEST_API_PORT} pnpm dev`,
      url: `http://localhost:${TEST_WEB_PORT}`,
      reuseExistingServer: !isCI,
      timeout: 30_000,
    },
    {
      // PORT is injected so NestJS listens on the test port (takes precedence over --env-file)
      command: `PORT=${TEST_API_PORT} pnpm --filter @rag-local/api dev:test`,
      url: `http://localhost:${TEST_API_PORT}/api/v1/health`,
      reuseExistingServer: !isCI,
      timeout: 60_000,
    },
  ],
});
