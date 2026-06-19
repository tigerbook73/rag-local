-- Refactor BEIR tables:
--   1. Separate doc text, chunk text, and embeddings into three layers
--   2. Split eval run details into per-query rows
-- BEIR corpus/eval data is re-importable from HuggingFace; no data migration is performed.

-- Drop old beir_corpus (had embedding_config + embedding inline)
DROP TABLE IF EXISTS "beir_corpus" CASCADE;

-- Clear beir_eval_runs and drop the inline details blob
TRUNCATE TABLE "beir_eval_runs";
ALTER TABLE "beir_eval_runs" DROP COLUMN IF EXISTS "details";

-- ── beir_corpus: doc text only ──────────────────────────────────────────────

CREATE TABLE "beir_corpus" (
    "id" UUID NOT NULL,
    "dataset" TEXT NOT NULL,
    "beir_doc_id" TEXT NOT NULL,
    "title" TEXT,
    "text" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "beir_corpus_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "beir_corpus_dataset_beir_doc_id_key" ON "beir_corpus"("dataset", "beir_doc_id");
CREATE INDEX "beir_corpus_dataset_idx" ON "beir_corpus"("dataset");

-- ── beir_corpus_chunks: chunked text per chunking config ────────────────────

CREATE TABLE "beir_corpus_chunks" (
    "id" UUID NOT NULL,
    "corpus_id" UUID NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "chunking_config" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "beir_corpus_chunks_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "beir_corpus_chunks_corpus_id_fkey"
        FOREIGN KEY ("corpus_id") REFERENCES "beir_corpus"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "beir_corpus_chunks_corpus_id_chunk_index_chunking_config_key"
    ON "beir_corpus_chunks"("corpus_id", "chunk_index", "chunking_config");
CREATE INDEX "beir_corpus_chunks_corpus_id_chunking_config_idx"
    ON "beir_corpus_chunks"("corpus_id", "chunking_config");

-- ── beir_corpus_embeddings: one row per chunk × embedding model ─────────────

CREATE TABLE "beir_corpus_embeddings" (
    "id" UUID NOT NULL,
    "chunk_id" UUID NOT NULL,
    "model" TEXT NOT NULL,
    "embedding" vector(1024) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "beir_corpus_embeddings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "beir_corpus_embeddings_chunk_id_fkey"
        FOREIGN KEY ("chunk_id") REFERENCES "beir_corpus_chunks"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "beir_corpus_embeddings_chunk_id_model_key"
    ON "beir_corpus_embeddings"("chunk_id", "model");
CREATE INDEX "beir_corpus_embeddings_model_idx"
    ON "beir_corpus_embeddings"("model");

-- ── beir_eval_run_details: one row per query per eval run ───────────────────

CREATE TABLE "beir_eval_run_details" (
    "id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "query_id" TEXT NOT NULL,
    "query_text" TEXT NOT NULL,
    "hits" JSONB NOT NULL,
    "ndcg10" DECIMAL(5, 4) NOT NULL,
    "relevant_in_top10" INTEGER NOT NULL,

    CONSTRAINT "beir_eval_run_details_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "beir_eval_run_details_run_id_fkey"
        FOREIGN KEY ("run_id") REFERENCES "beir_eval_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "beir_eval_run_details_run_id_idx" ON "beir_eval_run_details"("run_id");
