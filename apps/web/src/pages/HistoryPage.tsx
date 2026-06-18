import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, MessageSquare, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MessageBubble } from "../components/chat/MessageBubble.js";
import { deleteConversation, listConversations, listMessages } from "../lib/api.js";
import type { Conversation } from "../types/index.js";

// ── Conversation List ─────────────────────────────────────────────────────────

function ConversationListPanel({
  activeId,
  onSelect,
}: {
  activeId?: string;
  onSelect: (id: string) => void;
}) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["conversations"],
    queryFn: listConversations,
  });
  const conversations = data?.data ?? [];

  const { mutate: remove } = useMutation({
    mutationFn: (id: string) => deleteConversation(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["conversations"] }),
  });

  if (conversations.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm p-4">
        暂无对话记录
      </div>
    );
  }

  return (
    <ul className="flex-1 overflow-y-auto divide-y">
      {conversations.map((conv: Conversation) => (
        <li
          key={conv.id}
          className={cn(
            "group flex items-start gap-2 px-3 py-3 cursor-pointer hover:bg-accent",
            activeId === conv.id && "bg-accent",
          )}
          onClick={() => onSelect(conv.id)}
        >
          <MessageSquare className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{conv.title || "未命名对话"}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {new Date(conv.createdAt).toLocaleDateString()}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            className="shrink-0 opacity-0 group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              remove(conv.id);
            }}
            aria-label="删除对话"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </li>
      ))}
    </ul>
  );
}

// ── Conversation Detail ───────────────────────────────────────────────────────

function ConversationDetail({ id }: { id: string }) {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["messages", id],
    queryFn: () => listMessages(id),
  });
  const messages = data?.data ?? [];

  return (
    <div className="flex flex-col h-full">
      <div className="flex h-14 shrink-0 items-center gap-2 px-4 border-b">
        <Button
          variant="ghost"
          size="sm"
          className="md:hidden"
          onClick={() => void navigate("/history")}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          返回
        </Button>
        <span className="font-medium flex-1">对话详情</span>
        <Button size="sm" onClick={() => void navigate(`/chat/${id}`)}>
          继续对话
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
            加载中…
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
            暂无消息
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── HistoryPage ───────────────────────────────────────────────────────────────

export function HistoryPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();

  return (
    <div className="flex h-full">
      {/* Left panel — list; hidden on mobile when detail is shown */}
      <aside className={cn("w-70 shrink-0 border-r flex flex-col", id ? "hidden md:flex" : "flex")}>
        <div className="flex h-14 shrink-0 items-center px-4 border-b">
          <h1 className="font-medium">历史记录</h1>
        </div>
        <ConversationListPanel activeId={id} onSelect={(cid) => void navigate(`/history/${cid}`)} />
      </aside>

      {/* Right panel — detail; hidden on mobile when no id */}
      <main className={cn("flex-1 min-w-0", !id ? "hidden md:flex" : "flex flex-col")}>
        {id ? (
          <ConversationDetail id={id} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            选择一个对话查看详情
          </div>
        )}
      </main>
    </div>
  );
}
