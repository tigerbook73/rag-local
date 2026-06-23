import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { listEvaluations, listBeirRuns, getBeirRunDetail } from "../lib/api.js";
import type { EvaluationSummary, BeirEvalRunSummary } from "../lib/api.js";

const METRIC_LABELS: Record<string, string> = {
  faithfulness: "F",
  answer_relevancy: "AR",
  context_precision: "CP",
};

export function QualityPage() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex h-14 shrink-0 items-center px-4 border-b">
        <h1 className="font-medium">质量评估</h1>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        <Tabs defaultValue="online">
          <TabsList className="mb-4">
            <TabsTrigger value="online">在线评估</TabsTrigger>
            <TabsTrigger value="offline">BEIR 离线评估</TabsTrigger>
          </TabsList>
          <TabsContent value="online">
            <OnlineTab />
          </TabsContent>
          <TabsContent value="offline">
            <OfflineTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function OnlineTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["quality", "evaluations"],
    queryFn: () => listEvaluations({ limit: 50 }),
  });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">加载中...</div>;
  }

  if (!data || data.data.length === 0) {
    return (
      <div className="text-sm text-muted-foreground space-y-1">
        <p>暂无评估记录。</p>
        <p>
          前往 <span className="font-medium">Settings &gt; Query</span> 开启{" "}
          <span className="font-medium">Online Evaluation</span> 后，每次问答将自动触发评估。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {data.data.map((item) => (
        <EvaluationCard key={item.messageId} item={item} />
      ))}
      <p className="text-xs text-muted-foreground">共 {data.total} 条记录</p>
    </div>
  );
}

function EvaluationCard({ item }: { item: EvaluationSummary }) {
  const [open, setOpen] = useState(false);
  const [expandedMetric, setExpandedMetric] = useState<string | null>(null);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-lg border p-3 space-y-2">
        <CollapsibleTrigger className="w-full text-left">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              {item.conversationTitle && (
                <p className="text-xs text-muted-foreground truncate">{item.conversationTitle}</p>
              )}
              <p className="text-sm font-medium truncate">{item.question ?? "(无问题文本)"}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {item.evaluations.map((e) => (
                <Badge key={e.metric} variant="outline" className="text-xs h-5">
                  {METRIC_LABELS[e.metric] ?? e.metric}: {e.score.toFixed(2)}
                </Badge>
              ))}
              {open ? (
                <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-1.5 pt-1 border-t">
          {item.evaluations.map((e) => (
            <div key={e.metric}>
              <button
                className="flex items-center gap-2 text-xs w-full text-left"
                onClick={() => setExpandedMetric(expandedMetric === e.metric ? null : e.metric)}
              >
                <Badge variant="secondary" className="text-xs h-5">
                  {METRIC_LABELS[e.metric] ?? e.metric}: {e.score.toFixed(2)}
                </Badge>
                <span className="text-muted-foreground">{metricName(e.metric)}</span>
                {expandedMetric === e.metric ? (
                  <ChevronUp className="h-3 w-3 ml-auto text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-3 w-3 ml-auto text-muted-foreground" />
                )}
              </button>
              {expandedMetric === e.metric && e.reason && (
                <p className="text-xs text-muted-foreground mt-1 pl-2">{e.reason}</p>
              )}
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            {new Date(item.createdAt).toLocaleString()}
          </p>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function metricName(metric: string): string {
  const names: Record<string, string> = {
    faithfulness: "忠实度",
    answer_relevancy: "答案相关性",
    context_precision: "上下文精准度",
  };
  return names[metric] ?? metric;
}

function OfflineTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["quality", "beir-runs"],
    queryFn: () => listBeirRuns({ limit: 50 }),
  });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">加载中...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-3 bg-muted/40">
        <p className="text-xs font-medium mb-2">运行 BEIR 评估命令：</p>
        <pre className="text-xs overflow-x-auto">
          <code>{`cd packages/beir-eval

# 1. 导入数据集
pnpm beir-eval -- import --dataset scifact

# 2. 生成嵌入向量（dense / hybrid 模式需要）
pnpm beir-eval -- embed --dataset scifact

# 3. 运行评估（选择检索模式）
pnpm beir-eval -- eval --dataset scifact --retrieval dense
pnpm beir-eval -- eval --dataset scifact --retrieval bm25
pnpm beir-eval -- eval --dataset scifact --retrieval hybrid

# 4. 启用 Reranker（可追加到任意检索模式）
pnpm beir-eval -- eval --dataset scifact --retrieval dense --rerank`}</code>
        </pre>
      </div>

      {!data || data.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">暂无评估批次记录。</p>
      ) : (
        <div className="space-y-2">
          {data.data.map((run) => (
            <BeirRunCard key={run.id} run={run} />
          ))}
          <p className="text-xs text-muted-foreground">共 {data.total} 条记录</p>
        </div>
      )}
    </div>
  );
}

function BeirRunCard({ run }: { run: BeirEvalRunSummary }) {
  const [open, setOpen] = useState(false);

  const { data: detail } = useQuery({
    queryKey: ["quality", "beir-runs", run.id],
    queryFn: () => getBeirRunDetail(run.id),
    enabled: open,
  });

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-lg border p-3">
        <CollapsibleTrigger className="w-full text-left">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">
                {run.dataset}{" "}
                <span className="text-muted-foreground font-normal text-xs">
                  ({run.embeddingConfig})
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                样本 {run.sampleSize} 条 · {new Date(run.createdAt).toLocaleString()}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="text-right text-xs">
                <p>
                  nDCG@10: <span className="font-medium">{run.metrics.ndcg10.toFixed(4)}</span>
                </p>
                <p>
                  R@100: <span className="font-medium">{run.metrics.recall100.toFixed(4)}</span>
                </p>
              </div>
              {open ? (
                <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3 pt-3 border-t space-y-2">
          <div className="grid grid-cols-4 gap-2 text-xs">
            {(["ndcg10", "recall10", "recall100", "mrr10"] as const).map((k) => (
              <div key={k} className="rounded border p-2 text-center">
                <p className="text-muted-foreground">{k.replace(/(\d+)/, "@$1").toUpperCase()}</p>
                <p className="font-medium text-base">{run.metrics[k].toFixed(4)}</p>
              </div>
            ))}
          </div>
          {detail && detail.details.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium">逐查询详情（前 10 条）</p>
              {detail.details.slice(0, 10).map((q) => (
                <div key={q.queryId} className="text-xs rounded bg-muted/40 px-2 py-1.5">
                  <p className="truncate font-medium">{q.queryText}</p>
                  <p className="text-muted-foreground">
                    nDCG@10: {q.ndcg10.toFixed(4)} · 前10命中相关: {q.relevantInTop10}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
