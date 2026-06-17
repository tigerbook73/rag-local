import type { Client } from "pg";

/**
 * Default settings values — mirrors SETTINGS_DEFAULTS in settings.constants.ts.
 * Keep in sync when new settings keys are added.
 */
const DEFAULT_SETTINGS: [string, string][] = [
  ["llm_provider", "deepseek"],
  ["chunking_strategy", "fixed"],
  ["chunk_size", "512"],
  ["chunk_overlap", "50"],
  ["hyde_enabled", "false"],
  ["reranking_enabled", "false"],
  ["top_k", "5"],
  ["online_evaluation_enabled", "false"],
  ["conversation_history_window", "50"],
];

/**
 * Seed test schema with baseline data required for e2e tests.
 *
 * Called by globalSetup after TRUNCATE. Assumes search_path is already set
 * to the test schema on the provided client.
 */
export async function seedTestData(client: Client): Promise<void> {
  for (const [key, value] of DEFAULT_SETTINGS) {
    await client.query(
      `INSERT INTO settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [key, value],
    );
  }
}
