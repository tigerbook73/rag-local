import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Send, Plus } from "lucide-react";
import { createConversation, listMessages, streamChat, updateConversation } from "../lib/api.js";
import { useConversationStore } from "../stores/conversation.store.js";
import { MessageBubble } from "../components/chat/MessageBubble.js";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function ChatPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const {
    conversationId,
    messages,
    streaming,
    streamingContent,
    loadConversation,
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

  // Load existing conversation when navigating to /chat/:id
  useEffect(() => {
    if (!id) return;
    if (id === conversationId) return;

    listMessages(id)
      .then(({ data }) => loadConversation(id, data))
      .catch(() => setError("加载消息失败"));
  }, [id, conversationId, loadConversation]);

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
        loadConversation(convId, []);
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
    loadConversation,
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
      <div className="flex h-14 shrink-0 items-center justify-between px-4 border-b">
        <h1 className="font-medium">FAQ 问答</h1>
        <Button variant="ghost" size="sm" onClick={handleNewChat}>
          <Plus className="h-4 w-4" /> 新建对话
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {messages.length === 0 && !streaming ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
            在下方输入问题开始对话
          </div>
        ) : (
          <div className="p-4 space-y-4">
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
        )}
      </div>

      {error && (
        <Alert variant="destructive" className="mx-4 mb-2">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="border-t p-4">
        <div className="flex items-end gap-2 rounded-xl border bg-background px-3 py-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="输入问题… (Enter 发送, Shift+Enter 换行)"
            rows={1}
            className="flex-1 resize-none border-0 shadow-none focus-visible:ring-0 p-0 text-sm max-h-32 overflow-y-auto"
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${el.scrollHeight}px`;
            }}
            disabled={streaming}
          />
          <Button
            size="icon-sm"
            onClick={() => void handleSend()}
            disabled={!input.trim() || streaming}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
