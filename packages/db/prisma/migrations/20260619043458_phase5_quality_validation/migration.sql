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
    "embedding_config" TEXT NOT NULL,
    "embedding" vector(1024),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "beir_corpus_pkey" PRIMARY KEY ("id")
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
    "details" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "beir_eval_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "beir_corpus_dataset_embedding_config_idx" ON "beir_corpus"("dataset", "embedding_config");

-- CreateIndex
CREATE UNIQUE INDEX "beir_corpus_dataset_beir_doc_id_embedding_config_key" ON "beir_corpus"("dataset", "beir_doc_id", "embedding_config");

-- CreateIndex
CREATE UNIQUE INDEX "beir_queries_dataset_beir_query_id_key" ON "beir_queries"("dataset", "beir_query_id");

-- CreateIndex
CREATE INDEX "beir_eval_runs_dataset_created_at_idx" ON "beir_eval_runs"("dataset", "created_at");
