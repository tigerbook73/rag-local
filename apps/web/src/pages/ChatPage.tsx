import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Send, ChevronDown, ChevronUp, Plus } from "lucide-react";
import { createConversation, streamChat, updateConversation } from "../lib/api.js";
import { useConversationStore } from "../stores/conversation.store.js";
import type { Message, RetrievedChunk } from "../types/api.js";

export function ChatPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const {
    conversationId,
    messages,
    streaming,
    streamingContent,
    setConversationId,
    resetConversation,
    addUserMessage,
    startStreaming,
    appendStreamToken,
    finalizeStream,
  } = useConversationStore();

  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (id && id !== conversationId) setConversationId(id);
  }, [id, conversationId, setConversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  const handleNewChat = () => {
    abortRef.current?.abort();
    resetConversation();
    void navigate("/chat");
  };

  const handleSend = useCallback(async () => {
    const content = input.trim();
    if (!content || streaming) return;

    setInput("");
    setError(null);

    try {
      let convId = conversationId;

      if (!convId) {
        const conv = await createConversation();
        convId = conv.id;
        setConversationId(convId);
        void navigate(`/chat/${convId}`, { replace: true });
        updateConversation(convId, content.slice(0, 50)).catch(() => {});
      }

      addUserMessage(content);
      startStreaming();

      abortRef.current = new AbortController();
      await streamChat(
        convId,
        content,
        { onDelta: appendStreamToken, onDone: finalizeStream, onError: (e) => setError(e.message) },
        abortRef.current.signal,
      );
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError(String(e));
    }
  }, [
    input,
    streaming,
    conversationId,
    setConversationId,
    navigate,
    addUserMessage,
    startStreaming,
    appendStreamToken,
    finalizeStream,
  ]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h1 className="font-medium">FAQ 问答</h1>
        <button
          onClick={handleNewChat}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-4 w-4" /> 新建对话
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !streaming && (
          <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
            在下方输入问题开始对话
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {streaming && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-muted px-4 py-3 text-sm whitespace-pre-wrap">
              {streamingContent}
              <span className="inline-block w-1 h-4 bg-foreground animate-pulse ml-0.5 align-middle" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && (
        <div className="mx-4 mb-2 px-3 py-2 rounded bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      <div className="border-t p-4">
        <div className="flex items-end gap-2 rounded-xl border bg-background px-3 py-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="输入问题… (Enter 发送, Shift+Enter 换行)"
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground max-h-32 overflow-y-auto"
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${el.scrollHeight}px`;
            }}
            disabled={streaming}
          />
          <button
            onClick={() => void handleSend()}
            disabled={!input.trim() || streaming}
            className="flex-shrink-0 rounded-lg p-2 bg-primary text-primary-foreground disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className="max-w-[80%]">
        <div
          className={`rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap
            ${isUser ? "rounded-tr-sm bg-primary text-primary-foreground" : "rounded-tl-sm bg-muted"}`}
        >
          {message.content}
        </div>
        {!isUser && message.retrievedChunks && message.retrievedChunks.length > 0 && (
          <SourcesSection chunks={message.retrievedChunks} />
        )}
      </div>
    </div>
  );
}

function SourcesSection({ chunks }: { chunks: RetrievedChunk[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-1.5">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        引用来源 ({chunks.length})
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {chunks.map((chunk, i) => (
            <div key={chunk.chunkId} className="rounded-lg border bg-background p-3 text-xs">
              <p className="font-medium text-muted-foreground mb-1">
                [{i + 1}] {chunk.documentName}
                <span className="ml-2 opacity-60">
                  {(chunk.similarityScore * 100).toFixed(0)}% 相似
                </span>
              </p>
              <p className="text-foreground/80 line-clamp-3">{chunk.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
