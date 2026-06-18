# 04 — API 设计

---

## 4.1 约定

- **Base URL**：`/api/v1`
- **请求/响应格式**：JSON（流式除外）
- **流式输出**：SSE（`Content-Type: text/event-stream`）
- **错误格式**：`{ "error": { "code": string, "message": string } }`
- **时间格式**：ISO 8601 字符串（`createdAt: "2026-06-16T10:00:00Z"`）

---

## 4.2 类型共享工作流

```
NestJS DTO（class-validator + @nestjs/swagger 装饰器）
  ↓  pnpm gen:types
OpenAPI spec（stdout/内存管道，不落盘 openapi.json）
  ↓  openapi-typescript
apps/web/src/types/generated/api.ts（生成文件，勿手动编辑）
  ↓  apps/web/src/types/index.ts
前端 API client / 页面类型
```

**变更流程：** 改 NestJS DTO/entity/controller response 注解 → `pnpm gen:types` → 更新 `apps/web/src/types/index.ts` 中需要暴露的稳定类型。

生成文件 `apps/web/src/types/generated/api.ts` 纳入版本控制，`openapi.json` 不生成、不提交。

---

## 4.3 Conversations

```typescript
// 创建会话（前端在用户发第一条消息时自动调用）
POST   /conversations
Response: { id: string; title: string; createdAt: string }

// 获取会话列表
GET    /conversations
Response: { data: Conversation[]; total: number }

// 更新会话标题
PATCH  /conversations/:id
Body: { title: string }
Response: { id: string; title: string }

// 删除会话（同步删除所有消息和评估）
DELETE /conversations/:id
Response: 204 No Content
```

---

## 4.4 Chat（消息）

```typescript
// 发送消息（SSE 流式）
POST /conversations/:id/messages
Body: { content: string }
Response: text/event-stream
  event: delta   data: { content: string }
  event: done    data: { messageId: string; retrievedChunks: RetrievedChunk[]; latency: LatencyInfo }
  event: error   data: { code: string; message: string }

// 获取会话消息列表
GET  /conversations/:id/messages
Response: { data: Message[] }

// 提交用户反馈
PATCH /messages/:id/feedback
Body: { feedback: 'positive' | 'negative' }
Response: 204 No Content

// 查询消息评估结果（前端轮询，2-3 秒间隔）
GET  /messages/:id/evaluation
Response: { status: 'pending' | 'completed'; evaluations?: Evaluation[] }
```

---

## 4.5 Knowledge（文档）

```typescript
// 上传文档（multipart）
POST   /documents
Body: multipart/form-data { file: File }
Response: { id: string; filename: string; status: 'pending' }

// 获取文档列表
GET    /documents
Response: { data: Document[] }

// 获取单个文档（含处理状态和进度）
GET    /documents/:id
Response: Document

// 删除文档（同步删除关联 chunks 和向量）
DELETE /documents/:id
Response: 204 No Content

// 重试失败文档（重新入队）
POST   /documents/:id/retry
Response: { status: 'pending' }
```

---

## 4.6 Settings

```typescript
// 获取当前配置
GET   /settings
Response: Settings

// 更新配置（部分更新）
PATCH /settings
Body: Partial<Settings>
Response: Settings & { requiresReindex?: true }
// 若静态配置字段（chunking_strategy / chunk_size / chunk_overlap）有变更，
// 响应中包含 requiresReindex: true，前端展示提示条
```

---

## 4.7 Prompt Templates

```typescript
// 获取模板列表
GET    /prompt-templates
Response: { data: PromptTemplate[] }

// 创建模板
POST   /prompt-templates
Body: { name: string; content: string }
Response: PromptTemplate

// 更新模板（含激活/停用）
PATCH  /prompt-templates/:id
Body: { name?: string; content?: string; isActive?: boolean }
Response: PromptTemplate
// isActive: true 时，服务端在同一事务中停用其他所有模板

// 删除模板（不可删除激活中的模板）
DELETE /prompt-templates/:id
Response: 204 No Content
```

---

## 4.8 Quality

```typescript
// 获取在线评估列表（可按会话过滤）
GET /quality/evaluations
Query: { conversationId?: string; page?: number; limit?: number }
Response: { data: EvaluationSummary[]; total: number }

// 获取单条消息的检索可观测性数据
GET /quality/messages/:id/observability
Response: {
  retrievedChunks: RetrievedChunk[];
  prompt: string;                  // 完整送入 LLM 的 prompt
  latency: LatencyInfo;
  evaluations: Evaluation[];
}
```

---

## 4.9 TypeScript 类型参考

> 以下为设计阶段参考类型，实际以 `openapi-typescript` 从 OpenAPI spec 生成的类型为准。

```typescript
interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  documentName: string;
  content: string;
  similarityScore: number;
  rerankScore?: number; // Re-ranking 开启时有值
}

interface LatencyInfo {
  ttftMs: number;
  totalMs: number;
  retrievalMs: number;
}

interface Evaluation {
  metric: "faithfulness" | "answer_relevancy" | "context_precision";
  score: number; // 0.00 ~ 1.00
  reason: string;
}

interface Document {
  id: string;
  filename: string;
  fileType: "txt" | "md";
  status: "pending" | "processing" | "done" | "failed";
  errorMessage?: string;
  chunkingStrategy: "fixed" | "semantic";
  chunkSize: number;
  chunkOverlap: number;
  totalChunks?: number;
  processingCompletedAt?: string;
  createdAt: string;
}

interface Settings {
  llmProvider: "openai" | "deepseek";
  llmModel: string;
  llmBaseUrl?: string;
  chunkingStrategy: "fixed" | "semantic";
  chunkSize: number;
  chunkOverlap: number;
  hydeEnabled: boolean;
  rerankingEnabled: boolean;
  topK: number;
  onlineEvaluationEnabled: boolean;
  conversationHistoryWindow: number; // ⚠️ D-03：单位（条消息 vs 对话轮）待决策
}

interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  feedback?: "positive" | "negative";
  retrievedChunks?: RetrievedChunk[]; // assistant 消息有值
  ttftMs?: number;
  totalMs?: number;
  retrievalMs?: number;
  createdAt: string;
}

interface EvaluationSummary {
  messageId: string;
  conversationId: string;
  question: string; // 对应 user 消息 content
  evaluations: Evaluation[];
  createdAt: string;
}

interface PromptTemplate {
  id: string;
  name: string;
  content: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
```
