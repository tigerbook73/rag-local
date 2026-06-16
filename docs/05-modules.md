# 05 — 核心模块设计

所有核心逻辑放在 `packages/core`，由 `apps/api` 和 `apps/worker` 共同引用。

---

## 5.1 Chunking Strategy

```typescript
// packages/core/src/chunking/strategy.interface.ts

export interface ChunkResult {
  content: string;
  index: number;                        // 在文档中的顺序（0-based）
  metadata?: Record<string, unknown>;   // 预留，可存页码、标题段等
}

export interface ChunkingStrategy {
  chunk(text: string): ChunkResult[];
}

export class FixedSizeChunkingStrategy implements ChunkingStrategy {
  constructor(private chunkSize: number, private overlap: number) {}
  chunk(text: string): ChunkResult[] { /* 按字符数滑动窗口切分 */ }
}

export class SemanticChunkingStrategy implements ChunkingStrategy {
  chunk(text: string): ChunkResult[] { /* ⚠️ 算法待决策（D-04） */ }
}

// 工厂函数，Worker 和 API 通过此统一创建
export function createChunkingStrategy(settings: {
  strategy: 'fixed' | 'semantic';
  chunkSize: number;
  chunkOverlap: number;
}): ChunkingStrategy { ... }
```

**FixedSizeChunkingStrategy 实现要点：**

- 以字符数为单位（非 token 数），简单可控
- overlap 区域内容在相邻 chunk 中重复出现，保留语义连续性
- 边界处理：最后一个 chunk 不足 chunkSize 时保留全部剩余内容

---

## 5.2 Embedding Service

```typescript
// packages/core/src/embedding/embedding.service.ts

export class EmbeddingService {
  private pipeline: FeatureExtractionPipeline; // @huggingface/transformers

  // 应用启动时调用一次，加载 BGE-M3 ONNX 模型（耗时，需等待完成再接受请求）
  async init(): Promise<void>;

  // 单条文本 embedding，返回 1024 维向量
  async embed(text: string): Promise<number[]>;

  // 批量 embedding，Worker 处理文档时使用（减少模型调用开销）
  async embedBatch(texts: string[]): Promise<number[][]>;
}
```

**注意：** `EmbeddingService` 为单例，模型在进程启动时加载，不在每次请求时重新加载。API 进程和 Worker 进程各维护自己的单例实例。

---

## 5.3 LLM Service

```typescript
// packages/core/src/llm/llm.service.ts

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMConfig {
  provider: "openai" | "deepseek";
  model: string;
  baseUrl?: string;
  apiKey: string;
}

export class LLMService {
  private client: OpenAI; // openai npm 包，通过 baseURL 参数支持 DeepSeek

  // 从 Settings（DB）读取配置初始化，API 启动时调用
  async init(): Promise<void>;

  // 非流式调用（HyDE、LLM-as-judge 评估使用）
  async chat(messages: LLMMessage[]): Promise<string>;

  // 流式调用（Chat 问答使用）
  async *stream(messages: LLMMessage[]): AsyncGenerator<string>;

  // Settings 变更时重新初始化 client（不重启进程）
  async reinitialize(config: LLMConfig): Promise<void>;
}
```

---

## 5.4 Retrieval Service

```typescript
// packages/core/src/retrieval/retrieval.service.ts

export interface RetrievalOptions {
  topK: number;
  reranking: boolean;
  hyde: boolean;
}

export interface RetrievalResult {
  chunks: RetrievedChunk[];
  retrievalMs: number;
}

export class RetrievalService {
  constructor(
    private embeddingService: EmbeddingService,
    private llmService: LLMService, // HyDE 需要
    private prisma: PrismaClient,
  ) {}

  async retrieve(query: string, options: RetrievalOptions): Promise<RetrievalResult>;

  // 向量相似度检索（pgvector cosine similarity）
  private async vectorSearch(embedding: number[], topK: number): Promise<RetrievedChunk[]>;

  // Cross-encoder 重排序
  private async rerank(query: string, chunks: RetrievedChunk[]): Promise<RetrievedChunk[]>;
}
```

**retrieve 内部流程：**

```
query
  → [若 hyde] LLMService.chat(hydePrompt) → hydeAnswer → embed(hydeAnswer)
  → [否则]   embed(query)
  → vectorSearch(embedding, topK)
  → [若 reranking] rerank(query, chunks)
  → return { chunks, retrievalMs }
```

---

## 5.5 Evaluation Service（LLM-as-judge）

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

  // 并行执行三个指标评估
  async evaluate(input: EvaluationInput): Promise<MetricResult[]>;

  private async evaluateFaithfulness(input: EvaluationInput): Promise<MetricResult>;
  private async evaluateAnswerRelevancy(input: EvaluationInput): Promise<MetricResult>;
  private async evaluateContextPrecision(input: EvaluationInput): Promise<MetricResult>;
}
```

**实现原则：**

- 每个指标独立 LLM 调用，Prompt 分步拆解（参考 RAGAS prompt 结构）
- LLM 返回格式要求 JSON：`{ "score": 0.85, "reason": "..." }`
- 三个指标并行调用（`Promise.all`），减少总耗时
- 解析失败时 score 记录为 null，reason 记录错误信息，不影响主流程

---

## 5.6 BullMQ Job 类型

```typescript
// packages/core/src/types/jobs.ts

// 文档 Embedding Job（Worker 消费）
export interface EmbeddingJobData {
  documentId: string;
  storagePath: string;
  chunkingStrategy: "fixed" | "semantic";
  chunkSize: number;
  chunkOverlap: number;
}

// 在线评估 Job（⚠️ D-01：执行位置待决策 — Worker 还是 API 内异步）
export interface EvaluationJobData {
  messageId: string;
  question: string;
  answer: string;
  retrievedChunks: RetrievedChunk[];
}

// Queue 名称常量（API 和 Worker 共用）
export const QUEUE_NAMES = {
  EMBEDDING: "embedding",
  EVALUATION: "evaluation",
} as const;
```
