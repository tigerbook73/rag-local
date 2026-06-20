# 10 — Quality Validation 技术设计

---

## 10.1 总体架构

### 在线评估流程

```
用户发问
  → API streamChat()
  → 流式输出答案
  → 保存 assistant 消息（含 retrieved_chunks + prompt 字段）
  → 若 onlineEvaluationEnabled：入队 EvaluationJob（BullMQ）
  → SSE done 事件推送至前端

Worker EvaluationProcessor
  → 消费 EvaluationJob
  → EvaluationService.evaluate()（三指标并行 LLM-as-judge）
  → 写入 evaluations 表

前端 MessageBubble
  → 轮询 GET /messages/:id/evaluation（2.5s 间隔）
  → status=pending → 显示"评估中..."
  → status=completed → 显示 F / AR / CP 分数 + 可展开 reason
```

### BEIR 评估流程

```
CLI: python beir_eval.py import --dataset scifact
  → 从 HuggingFace 下载语料 / 查询 / qrels
  → 写入 beir_corpus / beir_queries / beir_qrels 表

CLI: python beir_eval.py embed --dataset scifact --config bge-m3-v1
  → 调 Embedding Sidecar（POST /embed/batch）
  → 批量写入 beir_corpus.embedding 字段

CLI: python beir_eval.py eval --dataset scifact --config bge-m3-v1 --sample 100
  → 随机抽取 N 条查询
  → 每条查询 embed → pgvector cosine search on beir_corpus
  → 对比 beir_qrels 计算 nDCG@10 / Recall@10 / Recall@100 / MRR@10
  → 写入 beir_eval_runs 表
  → Quality 页面 Offline Tab 展示

CLI: python beir_eval.py inject --dataset scifact --config bge-m3-v1
  → beir_corpus → documents + chunks（beir_source 标记）

CLI: python beir_eval.py eject --dataset scifact
  → 删除 documents 中 beir_source='scifact' 的记录（级联删除 chunks）
```

---

## 10.2 数据库变更

### 新增表

```prisma
// BEIR 语料及预生成 Embedding（支持多种配置）
model BeirCorpus {
  id              String                      @id @default(uuid()) @db.Uuid
  dataset         String
  beirDocId       String                      @map("beir_doc_id")
  title           String?
  text            String
  embeddingConfig String                      @map("embedding_config")
  embedding       Unsupported("vector(1024)")?
  createdAt       DateTime                    @default(now()) @map("created_at") @db.Timestamptz

  @@unique([dataset, beirDocId, embeddingConfig])
  @@index([dataset, embeddingConfig])
  @@map("beir_corpus")
}

// BEIR 查询集
model BeirQuery {
  id          String @id @default(uuid()) @db.Uuid
  dataset     String
  beirQueryId String @map("beir_query_id")
  text        String

  @@unique([dataset, beirQueryId])
  @@map("beir_queries")
}

// BEIR 相关性标注
model BeirQrel {
  dataset   String
  queryId   String @map("query_id")
  docId     String @map("doc_id")
  relevance Int    // 0 | 1 | 2

  @@id([dataset, queryId, docId])
  @@map("beir_qrels")
}

// BEIR 评估批次
model BeirEvalRun {
  id              String   @id @default(uuid()) @db.Uuid
  dataset         String
  embeddingConfig String   @map("embedding_config")
  sampleSize      Int      @map("sample_size")
  metrics         Json
  // { ndcg10: number, recall10: number, recall100: number, mrr10: number }
  details         Json
  // [{ queryId, queryText, hits: [{ docId, score }], relevantInTop10, ... }]
  createdAt       DateTime @default(now()) @map("created_at") @db.Timestamptz

  @@index([dataset, createdAt])
  @@map("beir_eval_runs")
}
```

### 修改现有表

**messages 表**：

```prisma
prompt String? // Serialized LLMMessage[] JSON for observability
```

**documents 表**：

```prisma
beirSource String? @map("beir_source") // BEIR dataset name if injected
```

---

## 10.3 在线评估模块

### EvaluationService（packages/core）

```typescript
// packages/core/src/evaluation/evaluation.service.ts

export interface EvaluationInput {
  question: string;
  answer: string;
  retrievedChunks: RetrievedChunk[];
}

export interface MetricResult {
  metric: "faithfulness" | "answer_relevancy" | "context_precision";
  score: number; // 0.00 ~ 1.00
  reason: string;
}

export class EvaluationService {
  constructor(private llmService: LLMService) {}

  // 三指标并行（Promise.all），JSON 解析失败 → score=0, reason="parse error: ..."
  async evaluate(input: EvaluationInput): Promise<MetricResult[]>;

  private async evaluateFaithfulness(input: EvaluationInput): Promise<MetricResult>;
  private async evaluateAnswerRelevancy(input: EvaluationInput): Promise<MetricResult>;
  private async evaluateContextPrecision(input: EvaluationInput): Promise<MetricResult>;
}
```

**LLM Prompt 约定**：每个指标单独一次非流式 `chat()` 调用，System Prompt 要求返回 JSON：

```
{ "score": <0.00~1.00>, "reason": "<explanation>" }
```

解析失败时不抛异常，以 `{ score: 0, reason: "parse error: ..." }` 降级处理。

### EvaluationProcessor（apps/worker）

```typescript
// apps/worker/src/processors/evaluation.processor.ts

@Processor(QUEUE_NAMES.EVALUATION, { concurrency: 2 })
export class EvaluationProcessor extends WorkerHost {
  async process(job: Job<EvaluationJobData>): Promise<void> {
    const results = await this.evaluationService.evaluate({
      question: job.data.question,
      answer: job.data.answer,
      retrievedChunks: job.data.retrievedChunks,
    });
    await this.prisma.evaluation.createMany({
      data: results.map((r) => ({
        messageId: job.data.messageId,
        metric: r.metric,
        score: r.score,
        reason: r.reason,
      })),
    });
  }
}
```

### 评估入队（apps/api messages 模块）

`messages.service.ts` 在保存 assistant 消息后：

```typescript
const assistantMsg = await this.prisma.message.create({
  data: {
    ...
    prompt: JSON.stringify(messages), // LLMMessage[] 序列化
  },
});

if (settings.onlineEvaluationEnabled) {
  await this.evalQueue.add("evaluate", {
    messageId: assistantMsg.id,
    question: dto.content,
    answer: fullContent,
    retrievedChunks: chunks,
  } satisfies EvaluationJobData, {
    attempts: 2,
    backoff: { type: "exponential", delay: 3000 },
  });
}
```

---

## 10.4 BEIR Pipeline

### CLI 子命令规范

```bash
# 从 HuggingFace 下载语料、查询、qrels 并写入 DB
python beir_eval.py import --dataset <name>

# 对指定 dataset + config 批量生成 embedding（增量，跳过已有记录）
python beir_eval.py embed --dataset <name> --config <config-name> [--batch-size 32]

# 直接模式评估：在 beir_corpus 表内检索，对比 qrels
python beir_eval.py eval \
  --dataset <name> \
  --config <config-name> \
  --sample <N> \
  [--metrics ndcg@10 recall@10 recall@100 mrr@10]

# 将指定 dataset+config 的语料注入生产 documents / chunks 表
python beir_eval.py inject --dataset <name> --config <config-name>

# 移除注入的生产文档（按 beir_source 删除）
python beir_eval.py eject --dataset <name>
```

### 评估算法（直接模式）

```
for each sampled query q:
  q_embedding = embed(q.text)
  hits = SELECT doc_id, 1 - (embedding <=> q_embedding) AS score
         FROM beir_corpus
         WHERE dataset = ? AND embedding_config = ?
         ORDER BY embedding <=> q_embedding
         LIMIT 100

  relevant_docs = { doc_id | qrels[q.id][doc_id].relevance >= 1 }

  ndcg@10  = nDCG(hits[:10], relevant_docs, qrels)
  recall@10  = |hits[:10] ∩ relevant_docs| / |relevant_docs|
  recall@100 = |hits[:100] ∩ relevant_docs| / |relevant_docs|
  mrr@10   = 1 / rank_of_first_relevant_in_hits[:10]

aggregate: mean across all sampled queries
→ write BeirEvalRun { metrics, details }
```

### 注入逻辑

注入时绕过 Worker 流程，直接写 DB：

```
beir_corpus (dataset, config) 每条记录
  → documents: { filename=title, status=done, beirSource=dataset, ... }
  → chunks:    { content=text, embedding=vector, ... }
```

注入前检查是否已存在同 dataset 的注入记录，避免重复。

---

## 10.5 API 设计

所有端点挂在 `QualityModule`，路由前缀 `/api/v1/quality`。

```typescript
// 在线评估列表（分页）
GET /quality/evaluations
Query: { conversationId?: string; page?: number; limit?: number }
Response: { data: EvaluationSummaryDto[]; total: number }

// 单条消息检索可观测性数据
GET /quality/messages/:id/observability
Response: {
  retrievedChunks: RetrievedChunkResponseDto[];
  prompt: string;        // JSON 序列化的 LLMMessage[]
  latency: LatencyInfo;  // { ttftMs, totalMs, retrievalMs }
  evaluations: EvaluationItemResponseDto[];
}

// BEIR 评估批次列表（分页）
GET /quality/beir-runs
Query: { dataset?: string; page?: number; limit?: number }
Response: { data: BeirEvalRunSummaryDto[]; total: number }

// BEIR 评估批次详情（含 per-query 结果）
GET /quality/beir-runs/:id
Response: BeirEvalRunDetailDto
```

---

## 10.6 前端

### MessageBubble 评估区

在 `SourcesSection` 之后新增 `EvaluationSection`，仅对 assistant 消息渲染：

```
onlineEvaluationEnabled=false  → 不渲染
status=pending                 → "评估中..." + 加载动画
status=completed               → F: 0.92  AR: 0.88  CP: 0.90（三个 Badge）
                                 点击展开 → reason 文字
```

轮询：`useQuery({ refetchInterval: 2500 })`，`status=completed` 后停止（`refetchInterval: false`）。

### Quality 页面

```
QualityPage
├── Tab: 在线评估（Online）
│   ├── 评估记录列表（conversationTitle / question 摘要 / 三项评分）
│   ├── 展开查看 reason
│   └── 空状态：提示开启 Settings > Query > Online Evaluation
└── Tab: BEIR 离线评估（Offline）
    ├── 运行命令说明（代码块）
    ├── 评估批次列表（dataset / config / sampleSize / nDCG@10 / Recall@100 / 时间）
    └── 点击展开 per-query 详情
```

---

## 10.7 验证方式

### 在线评估（AC-04）

```
Given Settings > Query 中 Online Evaluation 已开启
When  Chat 页面发送一条问题并等待回答完成
Then  消息下方出现"评估中..."指示器
And   2-3 秒后显示 F / AR / CP 三项分数
And   展开后可查看 reason 说明
And   下一条消息可立即发送，不被评估阻塞
And   Quality > Online Tab 显示该条评估记录
```

### BEIR 离线评估

```bash
cd scripts/beir-eval
pip install -r requirements.txt

python beir_eval.py import --dataset scifact
python beir_eval.py embed  --dataset scifact --config bge-m3-v1
python beir_eval.py eval   --dataset scifact --config bge-m3-v1 --sample 50
# → stdout 输出 nDCG@10 等指标
# → Quality > Offline Tab 出现新批次记录
```

### BEIR 注入体验

```bash
python beir_eval.py inject --dataset scifact --config bge-m3-v1
# → Knowledge 页面出现 SciFact 文档，Chat 可对其提问

python beir_eval.py eject --dataset scifact
# → SciFact 文档从 Knowledge 页面消失，用户自有文档不受影响
```
