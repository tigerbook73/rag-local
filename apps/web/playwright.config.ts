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

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: "html",

  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",

  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer: [
    {
      // Vite dev server (frontend) — uses dev env, no test-specific config needed
      command: "pnpm dev",
      url: "http://localhost:5173",
      reuseExistingServer: !isCI,
      timeout: 30_000,
    },
    {
      // NestJS API with test environment (.env.test → test schema + test-documents bucket)
      command: "pnpm --filter @rag-local/api dev:test",
      url: "http://localhost:3001/api/v1/health",
      reuseExistingServer: !isCI,
      timeout: 60_000,
    },
  ],
});
