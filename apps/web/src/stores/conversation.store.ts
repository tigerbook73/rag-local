import { create } from "zustand";
import type { Message, SseDoneEvent } from "../types/api.js";

interface ConversationState {
  conversationId: string | null;
  messages: Message[];
  streaming: boolean;
  streamingContent: string;

  setConversationId: (id: string) => void;
  resetConversation: () => void;
  addUserMessage: (content: string) => void;
  startStreaming: () => void;
  appendStreamToken: (token: string) => void;
  finalizeStream: (event: SseDoneEvent) => void;
  setMessages: (messages: Message[]) => void;
}

export const useConversationStore = create<ConversationState>((set) => ({
  conversationId: null,
  messages: [],
  streaming: false,
  streamingContent: "",

  setConversationId: (id) => set({ conversationId: id }),

  resetConversation: () =>
    set({ conversationId: null, messages: [], streaming: false, streamingContent: "" }),

  addUserMessage: (content) =>
    set((s) => ({
      messages: [
        ...s.messages,
        {
          id: `tmp-${Date.now()}`,
          conversationId: s.conversationId ?? "",
          role: "user",
          content,
          createdAt: new Date().toISOString(),
        },
      ],
    })),

  startStreaming: () => set({ streaming: true, streamingContent: "" }),

  appendStreamToken: (token) => set((s) => ({ streamingContent: s.streamingContent + token })),

  finalizeStream: (event: SseDoneEvent) =>
    set((s) => ({
      streaming: false,
      streamingContent: "",
      messages: [
        ...s.messages,
        {
          id: event.messageId,
          conversationId: s.conversationId ?? "",
          role: "assistant",
          content: s.streamingContent,
          retrievedChunks: event.retrievedChunks,
          ttftMs: event.latency.ttftMs,
          totalMs: event.latency.totalMs,
          retrievalMs: event.latency.retrievalMs,
          createdAt: new Date().toISOString(),
        },
      ],
    })),

  setMessages: (messages) => set({ messages }),
}));
