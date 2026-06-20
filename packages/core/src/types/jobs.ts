export interface EmbeddingJobData {
  documentId: string;
  storagePath: string;
  fileType: "txt" | "md" | "dataset";
  chunkingStrategy: "fixed" | "semantic";
  chunkSize: number;
  chunkOverlap: number;
}

import type { RetrievedChunk } from "./retrieval.js";

/** @see D-01 — evaluation job placement (worker vs api async) is TBD in Phase 5 */
export interface EvaluationJobData {
  messageId: string;
  question: string;
  answer: string;
  retrievedChunks: RetrievedChunk[];
}

export const QUEUE_NAMES = {
  EMBEDDING: "embedding",
  EVALUATION: "evaluation",
} as const;
