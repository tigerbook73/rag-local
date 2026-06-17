import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env["SUPABASE_URL"] ?? "http://127.0.0.1:54321";
const SUPABASE_SERVICE_KEY = process.env["SUPABASE_SERVICE_KEY"] ?? "";
const STORAGE_BUCKET = process.env["STORAGE_BUCKET"] ?? "test-documents";

export default async function globalTeardown(): Promise<void> {
  if (!SUPABASE_SERVICE_KEY) return;

  // Remove all test files from the test-documents bucket
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data: files, error } = await supabase.storage.from(STORAGE_BUCKET).list();

  if (error) {
    console.warn(`[e2e] Could not list "${STORAGE_BUCKET}" for cleanup: ${error.message}`);
    return;
  }

  if (files && files.length > 0) {
    const paths = files.map((f) => f.name);
    await supabase.storage.from(STORAGE_BUCKET).remove(paths);
    console.log(`[e2e] Removed ${paths.length} file(s) from "${STORAGE_BUCKET}" ✓`);
  }

  // DB data is left as-is — globalSetup will TRUNCATE on the next run
}
