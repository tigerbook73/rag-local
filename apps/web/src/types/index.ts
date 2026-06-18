import type { components } from "./generated/api";

export type Document = components["schemas"]["DocumentResponseDto"];
export type DocumentResponse = components["schemas"]["DocumentResponseDto"];
export type DocumentListResponse = components["schemas"]["DocumentListResponseDto"];
export type Conversation = components["schemas"]["ConversationResponseDto"];
export type ConversationResponse = components["schemas"]["ConversationResponseDto"];
export type ConversationCreateResponse = components["schemas"]["ConversationCreateResponseDto"];
export type ConversationListResponse = components["schemas"]["ConversationListResponseDto"];
export type Message = components["schemas"]["MessageResponseDto"];
export type MessageResponse = components["schemas"]["MessageResponseDto"];
export type MessageListResponse = components["schemas"]["MessageListResponseDto"];
export type RetrievedChunk = components["schemas"]["RetrievedChunkResponseDto"];
export type RetrievedChunkResponse = components["schemas"]["RetrievedChunkResponseDto"];
export type Settings = components["schemas"]["AppSettingsResponseDto"];
export type SettingsResponse = components["schemas"]["AppSettingsResponseDto"];
export type PromptTemplate = components["schemas"]["PromptTemplateResponseDto"];

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
