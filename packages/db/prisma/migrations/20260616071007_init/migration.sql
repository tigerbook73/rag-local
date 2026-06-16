-- CreateEnum
CREATE TYPE "LlmProvider" AS ENUM ('openai', 'deepseek');

-- CreateEnum
CREATE TYPE "ChunkingStrategy" AS ENUM ('fixed', 'semantic');

-- CreateTable
CREATE TABLE "settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "llm_provider" "LlmProvider" NOT NULL DEFAULT 'deepseek',
    "llm_model" TEXT NOT NULL DEFAULT 'deepseek-chat',
    "llm_base_url" TEXT,
    "chunking_strategy" "ChunkingStrategy" NOT NULL DEFAULT 'fixed',
    "chunk_size" INTEGER NOT NULL DEFAULT 512,
    "chunk_overlap" INTEGER NOT NULL DEFAULT 50,
    "hyde_enabled" BOOLEAN NOT NULL DEFAULT false,
    "reranking_enabled" BOOLEAN NOT NULL DEFAULT false,
    "top_k" INTEGER NOT NULL DEFAULT 5,
    "online_evaluation_enabled" BOOLEAN NOT NULL DEFAULT false,
    "conversation_history_window" INTEGER NOT NULL DEFAULT 50,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);
