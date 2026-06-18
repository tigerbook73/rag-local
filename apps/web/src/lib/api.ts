import createClient from "openapi-fetch";
import type { paths, components } from "../types/generated/api.js";
import type {
  Conversation,
  Document,
  Message,
  PromptTemplate,
  RetrievedChunk,
  Settings,
  SseDeltaEvent,
  SseDoneEvent,
  SseErrorEvent,
} from "../types/index.js";

const apiClient = createClient<paths>({ baseUrl: "" });

type ApiErrorBody = { error?: { message?: string } };

function throwOnError(error: unknown): never {
  throw new Error((error as ApiErrorBody)?.error?.message ?? "Request failed");
}

// ── Settings ─────────────────────────────────────────────────────────

export async function getSettings(): Promise<Settings> {
  const { data, error } = await apiClient.GET("/api/v1/settings");
  if (error) throwOnError(error);
  return data;
}

export async function updateSettings(
  body: components["schemas"]["UpdateSettingsDto"],
): Promise<Settings> {
  const { data, error } = await apiClient.PATCH("/api/v1/settings", { body });
  if (error) throwOnError(error);
  return data;
}

// ── Prompt Templates ─────────────────────────────────────────────────

export async function listPromptTemplates(): Promise<{ data: PromptTemplate[] }> {
  const { data, error } = await apiClient.GET("/api/v1/prompt-templates");
  if (error) throwOnError(error);
  return data;
}

export async function createPromptTemplate(
  body: components["schemas"]["CreatePromptTemplateDto"],
): Promise<PromptTemplate> {
  const { data, error } = await apiClient.POST("/api/v1/prompt-templates", { body });
  if (error) throwOnError(error);
  return data;
}

export async function updatePromptTemplate(
  id: string,
  body: components["schemas"]["UpdatePromptTemplateDto"],
): Promise<PromptTemplate> {
  const { data, error } = await apiClient.PATCH("/api/v1/prompt-templates/{id}", {
    params: { path: { id } },
    body,
  });
  if (error) throwOnError(error);
  return data;
}

export async function deletePromptTemplate(id: string): Promise<void> {
  const { error } = await apiClient.DELETE("/api/v1/prompt-templates/{id}", {
    params: { path: { id } },
  });
  if (error) throwOnError(error);
}

// ── Feedback ─────────────────────────────────────────────────────────

export async function updateMessageFeedback(
  id: string,
  feedback: "positive" | "negative",
): Promise<void> {
  const { error } = await apiClient.PATCH("/api/v1/messages/{id}/feedback", {
    params: { path: { id } },
    body: { feedback },
  });
  if (error) throwOnError(error);
}

// ── Documents ────────────────────────────────────────────────────────

export async function uploadDocument(
  file: File,
): Promise<components["schemas"]["UploadDocumentResponseDto"]> {
  // Raw fetch: openapi-typescript represents binary fields as `string`, so
  // we build FormData manually instead of fighting the type mismatch.
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/v1/documents", { method: "POST", body: form });
  if (!res.ok) {
    const body = await (res.json() as Promise<ApiErrorBody>).catch((): ApiErrorBody => ({}));
    throw new Error(body.error?.message ?? res.statusText);
  }
  return res.json() as Promise<components["schemas"]["UploadDocumentResponseDto"]>;
}

export async function listDocuments(): Promise<{ data: Document[] }> {
  const { data, error } = await apiClient.GET("/api/v1/documents");
  if (error) throwOnError(error);
  return data;
}

export async function deleteDocument(id: string): Promise<void> {
  const { error } = await apiClient.DELETE("/api/v1/documents/{id}", {
    params: { path: { id } },
  });
  if (error) throwOnError(error);
}

export async function retryDocument(
  id: string,
): Promise<components["schemas"]["RetryDocumentResponseDto"]> {
  const { data, error } = await apiClient.POST("/api/v1/documents/{id}/retry", {
    params: { path: { id } },
  });
  if (error) throwOnError(error);
  return data;
}

// ── Conversations ────────────────────────────────────────────────────

export async function createConversation(): Promise<components["schemas"]["ConversationCreateResponseDto"]> {
  const { data, error } = await apiClient.POST("/api/v1/conversations");
  if (error) throwOnError(error);
  return data;
}

export async function listConversations(): Promise<{ data: Conversation[]; total: number }> {
  const { data, error } = await apiClient.GET("/api/v1/conversations");
  if (error) throwOnError(error);
  return data;
}

export async function updateConversation(
  id: string,
  title: string,
): Promise<components["schemas"]["ConversationUpdateResponseDto"]> {
  const { data, error } = await apiClient.PATCH("/api/v1/conversations/{id}", {
    params: { path: { id } },
    body: { title },
  });
  if (error) throwOnError(error);
  return data;
}

export async function deleteConversation(id: string): Promise<void> {
  const { error } = await apiClient.DELETE("/api/v1/conversations/{id}", {
    params: { path: { id } },
  });
  if (error) throwOnError(error);
}

// ── Messages ─────────────────────────────────────────────────────────

export async function listMessages(id: string): Promise<{ data: Message[] }> {
  const { data, error } = await apiClient.GET("/api/v1/conversations/{id}/messages", {
    params: { path: { id } },
  });
  if (error) throwOnError(error);
  return data;
}

export interface StreamChatCallbacks {
  onDelta: (content: string) => void;
  onDone: (event: SseDoneEvent) => void;
  onError: (event: SseErrorEvent) => void;
}

/** POST /conversations/:id/messages with SSE streaming response */
export async function streamChat(
  id: string,
  content: string,
  callbacks: StreamChatCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  // Raw fetch: SSE streaming is not supported by openapi-fetch.
  const res = await fetch(`/api/v1/conversations/${id}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
    signal,
  });

  if (!res.ok || !res.body) {
    callbacks.onError({ code: String(res.status), message: res.statusText });
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const messages = buffer.split("\n\n");
    buffer = messages.pop() ?? "";

    for (const raw of messages) {
      if (!raw.trim()) continue;
      const lines = raw.split("\n");
      let eventType = "message";
      let dataStr = "";
      for (const line of lines) {
        if (line.startsWith("event: ")) eventType = line.slice(7);
        else if (line.startsWith("data: ")) dataStr = line.slice(6);
      }
      if (!dataStr) continue;

      try {
        const payload: unknown = JSON.parse(dataStr);
        if (eventType === "delta") callbacks.onDelta((payload as SseDeltaEvent).content);
        else if (eventType === "done") callbacks.onDone(payload as SseDoneEvent);
        else if (eventType === "error") callbacks.onError(payload as SseErrorEvent);
      } catch {
        // ignore malformed SSE frames
      }
    }
  }
}

// ── Evaluations ──────────────────────────────────────────────────────

export async function getEvaluation(
  id: string,
): Promise<components["schemas"]["EvaluationResponseDto"]> {
  const { data, error } = await apiClient.GET("/api/v1/messages/{id}/evaluation", {
    params: { path: { id } },
  });
  if (error) throwOnError(error);
  return data;
}

// Re-export for callers that use these types directly from this module
export type { RetrievedChunk };
