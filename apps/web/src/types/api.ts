/**
 * Hand-written API types based on docs/04-api.md.
 * Regenerate with `pnpm gen:types` once the API is running.
 */

export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  documentName: string;
  content: string;
  similarityScore: number;
  rerankScore?: number;
}

export interface LatencyInfo {
  ttftMs: number;
  totalMs: number;
  retrievalMs: number;
}

export interface Evaluation {
  metric: "faithfulness" | "answer_relevancy" | "context_precision";
  score: number;
  reason: string | null;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  feedback?: "positive" | "negative";
  retrievedChunks?: RetrievedChunk[];
  ttftMs?: number;
  totalMs?: number;
  retrievalMs?: number;
  createdAt: string;
}

export interface Document {
  id: string;
  filename: string;
  fileType: "txt" | "md";
  status: "pending" | "processing" | "done" | "failed";
  errorMessage?: string;
  chunkingStrategy: "fixed" | "semantic";
  chunkSize: number;
  chunkOverlap: number;
  totalChunks?: number;
  processingCompletedAt?: string;
  createdAt: string;
}

export interface Settings {
  llmProvider: "openai" | "deepseek";
  llmModel: string;
  llmBaseUrl?: string;
  chunkingStrategy: "fixed" | "semantic";
  chunkSize: number;
  chunkOverlap: number;
  hydeEnabled: boolean;
  rerankingEnabled: boolean;
  topK: number;
  onlineEvaluationEnabled: boolean;
  conversationHistoryWindow: number;
}

// SSE event payloads
export interface SseDeltaEvent {
  content: string;
}

export interface SseDoneEvent {
  messageId: string;
  retrievedChunks: RetrievedChunk[];
  latency: LatencyInfo;
}

export interface SseErrorEvent {
  code: string;
  message: string;
}
