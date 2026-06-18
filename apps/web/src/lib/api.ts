import type {
  Conversation,
  ConversationCreateResponse,
  Document,
  Message,
  SseDeltaEvent,
  SseDoneEvent,
  SseErrorEvent,
} from "../types/index.js";

const BASE = "/api/v1";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await (res.json() as Promise<{ error?: { message?: string } }>).catch(
      (): { error?: { message?: string } } => ({}),
    );
    throw new Error(body.error?.message ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

// ── Documents ────────────────────────────────────────────────────────

export async function uploadDocument(
  file: File,
): Promise<{ id: string; filename: string; status: string }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/documents`, { method: "POST", body: form });
  return json(res);
}

export async function listDocuments(): Promise<{ data: Document[] }> {
  const res = await fetch(`${BASE}/documents`);
  return json(res);
}

export async function deleteDocument(id: string): Promise<void> {
  await fetch(`${BASE}/documents/${id}`, { method: "DELETE" });
}

export async function retryDocument(id: string): Promise<{ status: string }> {
  const res = await fetch(`${BASE}/documents/${id}/retry`, { method: "POST" });
  return json(res);
}

// ── Conversations ────────────────────────────────────────────────────

export async function createConversation(): Promise<ConversationCreateResponse> {
  const res = await fetch(`${BASE}/conversations`, { method: "POST" });
  return json(res);
}

export async function listConversations(): Promise<{ data: Conversation[]; total: number }> {
  const res = await fetch(`${BASE}/conversations`);
  return json(res);
}

export async function updateConversation(
  id: string,
  title: string,
): Promise<{ id: string; title: string }> {
  const res = await fetch(`${BASE}/conversations/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  return json(res);
}

export async function deleteConversation(id: string): Promise<void> {
  await fetch(`${BASE}/conversations/${id}`, { method: "DELETE" });
}

// ── Messages ─────────────────────────────────────────────────────────

export async function listMessages(conversationId: string): Promise<{ data: Message[] }> {
  const res = await fetch(`${BASE}/conversations/${conversationId}/messages`);
  return json(res);
}

export interface StreamChatCallbacks {
  onDelta: (content: string) => void;
  onDone: (event: SseDoneEvent) => void;
  onError: (event: SseErrorEvent) => void;
}

/** POST /conversations/:id/messages with SSE streaming response */
export async function streamChat(
  conversationId: string,
  content: string,
  callbacks: StreamChatCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${BASE}/conversations/${conversationId}/messages`, {
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
