-- beir_corpus: for beir-eval BM25 evaluation
ALTER TABLE "beir_corpus"
  ADD COLUMN "fts" tsvector
    GENERATED ALWAYS AS (
      to_tsvector('english', COALESCE(title, '') || ' ' || text)
    ) STORED;

CREATE INDEX "beir_corpus_fts_idx" ON "beir_corpus" USING GIN ("fts");

-- chunks: for production BM25 retrieval
ALTER TABLE "chunks"
  ADD COLUMN "fts" tsvector
    GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;

CREATE INDEX "chunks_fts_idx" ON "chunks" USING GIN ("fts");
