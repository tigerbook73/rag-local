import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Send, Plus } from "lucide-react";
import {
  createConversation,
  getSettings,
  listMessages,
  sampleBeirQueries,
  streamChat,
  updateConversation,
} from "../lib/api.js";
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

  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: getSettings });
  const showEvaluation = settings?.onlineEvaluationEnabled ?? false;

  const { data: sampleQueries = [] } = useQuery({
    queryKey: ["beir-sample-queries"],
    queryFn: () => sampleBeirQueries(8),
    staleTime: Infinity,
    enabled: !id,
  });

  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Tracks a conversation id that was just created by handleSend so the
  // useEffect below doesn't overwrite the optimistic store state.
  const freshConvIdRef = useRef<string | null>(null);

  // Load existing conversation when navigating to /chat/:id.
  // Intentionally omit conversationId from deps — resetting the store must not
  // re-trigger a load while the URL still points to the old id.
  useEffect(() => {
    if (!id) return;
    if (id === freshConvIdRef.current) {
      freshConvIdRef.current = null;
      return;
    }

    listMessages(id)
      .then(({ data }) => loadConversation(id, data))
      .catch(() => setError("加载消息失败"));
  }, [id, loadConversation]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  // Greedy two-column split: sort longest-first, always append to the shorter column.
  // Order doesn't matter — this minimises height difference between the two columns.
  const queryCols = (() => {
    const cols = [[], []] as [typeof sampleQueries, typeof sampleQueries];
    const totals: [number, number] = [0, 0];
    [...sampleQueries]
      .sort((a, b) => b.text.length - a.text.length)
      .forEach((q) => {
        const col = totals[0] <= totals[1] ? 0 : 1;
        cols[col].push(q);
        totals[col] += q.text.length;
      });
    return cols;
  })();

  const handleNewChat = () => {
    abortRef.current?.abort();
    resetConversation();
    void navigate("/chat");
  };

  const handleSend = useCallback(
    async (overrideContent?: string) => {
      const content = (overrideContent ?? input).trim();
      if (!content || streaming) return;

      if (!overrideContent) setInput("");
      setError(null);

      try {
        let convId = conversationId;

        if (!convId) {
          const conv = await createConversation();
          convId = conv.id;
          freshConvIdRef.current = convId;
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
          {
            onDelta: appendStreamToken,
            onDone: finalizeStream,
            onError: (e) => setError(e.message),
          },
          abortRef.current.signal,
        );
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError(String(e));
      }
    },
    [
      input,
      streaming,
      conversationId,
      loadConversation,
      navigate,
      addUserMessage,
      startStreaming,
      appendStreamToken,
      finalizeStream,
    ],
  );

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
          <div className="h-full flex flex-col items-center justify-center gap-6 px-8">
            {sampleQueries.length > 0 && (
              <>
                <p className="text-sm text-muted-foreground">试试这些问题</p>
                <div className="flex gap-2 w-full max-w-xl">
                  {queryCols.map((col, ci) => (
                    <div key={ci} className="flex-1 flex flex-col gap-2">
                      {col.map((q) => (
                        <button
                          key={q.id}
                          onClick={() => void handleSend(q.text)}
                          className="w-full text-left text-sm px-3 py-2.5 rounded-lg border bg-background hover:bg-muted transition-colors"
                        >
                          {q.text}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </>
            )}
            <p className="text-muted-foreground text-sm">在下方输入问题开始对话</p>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} showEvaluation={showEvaluation} />
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
