-- Migrate settings from singleton row to key-value store

-- Drop old typed singleton table
DROP TABLE IF EXISTS "settings";

-- Create new key-value settings table
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- Seed default values
INSERT INTO "settings" ("key", "value") VALUES
    ('llm_provider',               'deepseek'),
    ('chunking_strategy',          'fixed'),
    ('chunk_size',                 '512'),
    ('chunk_overlap',              '50'),
    ('hyde_enabled',               'false'),
    ('reranking_enabled',          'false'),
    ('top_k',                      '5'),
    ('online_evaluation_enabled',  'false'),
    ('conversation_history_window','50');
