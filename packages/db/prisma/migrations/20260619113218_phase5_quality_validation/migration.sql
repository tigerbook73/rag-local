-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "beir_source" TEXT;

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "prompt" TEXT;

-- CreateTable
CREATE TABLE "beir_corpus" (
    "id" UUID NOT NULL,
    "dataset" TEXT NOT NULL,
    "beir_doc_id" TEXT NOT NULL,
    "title" TEXT,
    "text" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "beir_corpus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beir_corpus_chunks" (
    "id" UUID NOT NULL,
    "corpus_id" UUID NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "chunking_config" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "beir_corpus_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beir_corpus_embeddings" (
    "id" UUID NOT NULL,
    "chunk_id" UUID NOT NULL,
    "model" TEXT NOT NULL,
    "embedding" vector(1024) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "beir_corpus_embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beir_queries" (
    "id" UUID NOT NULL,
    "dataset" TEXT NOT NULL,
    "beir_query_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "beir_queries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beir_qrels" (
    "dataset" TEXT NOT NULL,
    "query_id" TEXT NOT NULL,
    "doc_id" TEXT NOT NULL,
    "relevance" INTEGER NOT NULL,

    CONSTRAINT "beir_qrels_pkey" PRIMARY KEY ("dataset","query_id","doc_id")
);

-- CreateTable
CREATE TABLE "beir_eval_runs" (
    "id" UUID NOT NULL,
    "dataset" TEXT NOT NULL,
    "embedding_config" TEXT NOT NULL,
    "sample_size" INTEGER NOT NULL,
    "metrics" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "beir_eval_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beir_eval_run_details" (
    "id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "query_id" TEXT NOT NULL,
    "query_text" TEXT NOT NULL,
    "hits" JSONB NOT NULL,
    "ndcg10" DECIMAL(5,4) NOT NULL,
    "relevant_in_top10" INTEGER NOT NULL,

    CONSTRAINT "beir_eval_run_details_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "beir_corpus_dataset_idx" ON "beir_corpus"("dataset");

-- CreateIndex
CREATE UNIQUE INDEX "beir_corpus_dataset_beir_doc_id_key" ON "beir_corpus"("dataset", "beir_doc_id");

-- CreateIndex
CREATE INDEX "beir_corpus_chunks_corpus_id_chunking_config_idx" ON "beir_corpus_chunks"("corpus_id", "chunking_config");

-- CreateIndex
CREATE UNIQUE INDEX "beir_corpus_chunks_corpus_id_chunk_index_chunking_config_key" ON "beir_corpus_chunks"("corpus_id", "chunk_index", "chunking_config");

-- CreateIndex
CREATE INDEX "beir_corpus_embeddings_model_idx" ON "beir_corpus_embeddings"("model");

-- CreateIndex
CREATE UNIQUE INDEX "beir_corpus_embeddings_chunk_id_model_key" ON "beir_corpus_embeddings"("chunk_id", "model");

-- CreateIndex
CREATE UNIQUE INDEX "beir_queries_dataset_beir_query_id_key" ON "beir_queries"("dataset", "beir_query_id");

-- CreateIndex
CREATE INDEX "beir_eval_runs_dataset_created_at_idx" ON "beir_eval_runs"("dataset", "created_at");

-- CreateIndex
CREATE INDEX "beir_eval_run_details_run_id_idx" ON "beir_eval_run_details"("run_id");

-- AddForeignKey
ALTER TABLE "beir_corpus_chunks" ADD CONSTRAINT "beir_corpus_chunks_corpus_id_fkey" FOREIGN KEY ("corpus_id") REFERENCES "beir_corpus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beir_corpus_embeddings" ADD CONSTRAINT "beir_corpus_embeddings_chunk_id_fkey" FOREIGN KEY ("chunk_id") REFERENCES "beir_corpus_chunks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beir_eval_run_details" ADD CONSTRAINT "beir_eval_run_details_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "beir_eval_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
