import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";
import { Queue } from "bullmq";
import { seedTestData } from "./seed.js";

const DB_URL = process.env["DATABASE_URL"] ?? "";
const SUPABASE_URL = process.env["SUPABASE_URL"] ?? "http://127.0.0.1:54321";
const SUPABASE_SERVICE_KEY = process.env["SUPABASE_SERVICE_KEY"] ?? "";
const STORAGE_BUCKET = process.env["STORAGE_BUCKET"] ?? "test-documents";

export default async function globalSetup(): Promise<void> {
  if (!DB_URL) {
    throw new Error("[e2e globalSetup] DATABASE_URL is not set. Check .env.test or CI env vars.");
  }

  // Support both ?schema=test and ?search_path=test,extensions URL formats
  const params = new URL(DB_URL).searchParams;
  const schema =
    params.get("schema") ?? params.get("search_path")?.split(",")[0]?.trim() ?? "public";

  // Guard: refuse to run against public schema to prevent dev data pollution
  if (schema === "public") {
    throw new Error(
      "[e2e globalSetup] DATABASE_URL is missing '?schema=test'.\n" +
        "  e2e tests refuse to run against the public schema.\n" +
        "  Please check .env.test and ensure DATABASE_URL ends with ?schema=test",
    );
  }

  // 1. Flush BullMQ test queues — prevents stale jobs from a previous run being picked up
  const redisUrl = process.env["REDIS_URL"] ?? "redis://localhost:6379";
  const prefix = process.env["REDIS_KEY_PREFIX"] || undefined;
  const queues = ["embedding", "evaluation"].map(
    (name) => new Queue(name, { connection: { url: redisUrl }, prefix }),
  );
  await Promise.all(queues.map((q) => q.obliterate({ force: true })));
  await Promise.all(queues.map((q) => q.close()));
  console.log(`[e2e] BullMQ queues flushed ✓`);

  // 2. Ensure test-documents bucket exists (idempotent — safe to call on every run)
  if (SUPABASE_SERVICE_KEY) {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { error } = await supabase.storage.createBucket(STORAGE_BUCKET, {
      public: false,
      allowedMimeTypes: ["text/plain", "text/markdown", "text/x-markdown"],
      fileSizeLimit: 10 * 1024 * 1024,
    });
    // "already exists" is expected on subsequent runs — ignore it
    if (error && !error.message.toLowerCase().includes("already exist")) {
      throw new Error(
        `[e2e globalSetup] Failed to create bucket "${STORAGE_BUCKET}": ${error.message}`,
      );
    }
  }

  // Strip Prisma-specific URL params — pg client uses SET search_path instead
  const pgUrl = DB_URL.replace(/[?&](schema|search_path)=[^&]*/g, "").replace(/[?&]$/, "");

  const client = new Client({ connectionString: pgUrl });
  await client.connect();

  try {
    await client.query(`SET search_path TO "${schema}", public`);

    // 3. Truncate all business tables (CASCADE handles FK dependencies)
    await client.query(`
      TRUNCATE TABLE
        evaluations,
        messages,
        conversations,
        chunks,
        documents,
        prompt_templates,
        settings
      RESTART IDENTITY CASCADE
    `);

    // 4. Seed baseline test data
    await seedTestData(client);

    console.log(`[e2e] schema "${schema}" reset and seeded ✓`);
  } finally {
    await client.end();
  }
}
