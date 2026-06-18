import type { components } from "./generated/api";

export type Document = components["schemas"]["DocumentResponseDto"];
export type Conversation = components["schemas"]["ConversationResponseDto"];
export type Message = components["schemas"]["MessageResponseDto"];
export type PromptTemplate = components["schemas"]["PromptTemplateResponseDto"];
export type Settings = components["schemas"]["AppSettingsResponseDto"];
export type RetrievedChunk = components["schemas"]["RetrievedChunkResponseDto"];

export interface LatencyInfo {
  ttftMs: number;
  totalMs: number;
  retrievalMs: number;
}

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
