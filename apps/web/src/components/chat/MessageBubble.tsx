import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { Message, RetrievedChunk } from "../../types/index.js";

export function MessageBubble({ message }: { message: Message }) {
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

export function SourcesSection({ chunks }: { chunks: RetrievedChunk[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-1.5">
      <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        引用来源 ({chunks.length})
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-2">
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
      </CollapsibleContent>
    </Collapsible>
  );
}
