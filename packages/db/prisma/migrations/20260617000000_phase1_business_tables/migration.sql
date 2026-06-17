-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('user', 'assistant');

-- CreateEnum
CREATE TYPE "MessageFeedback" AS ENUM ('positive', 'negative');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('pending', 'processing', 'done', 'failed');

-- CreateEnum
CREATE TYPE "DocumentFiletype" AS ENUM ('txt', 'md');

-- CreateEnum
CREATE TYPE "EvalMetric" AS ENUM ('faithfulness', 'answer_relevancy', 'context_precision');

-- CreateTable: conversations
CREATE TABLE "conversations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable: messages
CREATE TABLE "messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conversation_id" UUID NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "feedback" "MessageFeedback",
    "retrieved_chunks" JSONB,
    "ttft_ms" INTEGER,
    "total_ms" INTEGER,
    "retrieval_ms" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "messages_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id")
        REFERENCES "conversations"("id") ON DELETE CASCADE
);

CREATE INDEX "idx_messages_conversation_id" ON "messages"("conversation_id");

-- CreateTable: documents
CREATE TABLE "documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "filename" TEXT NOT NULL,
    "file_type" "DocumentFiletype" NOT NULL,
    "storage_path" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'pending',
    "error_message" TEXT,
    "chunking_strategy" "ChunkingStrategy" NOT NULL DEFAULT 'fixed',
    "chunk_size" INTEGER NOT NULL,
    "chunk_overlap" INTEGER NOT NULL,
    "total_chunks" INTEGER,
    "processing_started_at" TIMESTAMPTZ,
    "processing_completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable: chunks
CREATE TABLE "chunks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "document_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1024) NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "chunks_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chunks_document_id_fkey" FOREIGN KEY ("document_id")
        REFERENCES "documents"("id") ON DELETE CASCADE
);

CREATE INDEX "idx_chunks_document_id" ON "chunks"("document_id");

-- Vector similarity index (cosine), suitable for tens of thousands of chunks
CREATE INDEX "idx_chunks_embedding" ON "chunks"
    USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);

-- CreateTable: evaluations
CREATE TABLE "evaluations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "message_id" UUID NOT NULL,
    "metric" "EvalMetric" NOT NULL,
    "score" NUMERIC(3, 2) NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "evaluations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "evaluations_message_id_fkey" FOREIGN KEY ("message_id")
        REFERENCES "messages"("id") ON DELETE CASCADE
);

CREATE INDEX "idx_evaluations_message_id" ON "evaluations"("message_id");

-- CreateTable: prompt_templates
CREATE TABLE "prompt_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "prompt_templates_pkey" PRIMARY KEY ("id")
);

-- Unique partial index: at most one active prompt template
CREATE UNIQUE INDEX "idx_prompt_templates_active"
    ON "prompt_templates" ("is_active")
    WHERE is_active = true;
