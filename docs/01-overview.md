# 01 — 系统概览

---

## 1.1 项目定位

基于 RAG（检索增强生成）的本地 FAQ 问答系统。支持导入文档作为知识库，通过自然语言提问获取答案，并内置质量评估能力。

**核心约束：**

- **单用户**：无注册/登录/权限管理
- **本地部署**：全部服务本地运行，不依赖任何云服务
- **数据可控**：不引入 LangChain / LlamaIndex，各步骤使用专项库自实现，保持完整数据可控性

---

## 1.2 技术栈

| 层级       | 选型                                                        | 选型原因                                                                                         |
| ---------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Frontend   | React + React Router                                        | 生态成熟，与 Vite 配合开发体验好                                                                 |
| Backend    | NestJS                                                      | 模块化架构适合拆分 documents/messages/settings 等模块；内置 DI、Pipe、Guard；TypeScript 一等公民 |
| 异步队列   | BullMQ + Redis                                              | Embedding 是 CPU 密集型操作，必须异步处理；BullMQ 支持 job 持久化、重试、并发控制                |
| 数据库     | Supabase Local（PostgreSQL + pgvector）                     | pgvector 原生向量检索；Supabase Local 提供 Storage；本地运行无需上云                             |
| 文件存储   | Supabase Storage                                            | 与 DB 同一套 Supabase Local 实例，运维简单                                                       |
| Embedding  | BGE-M3 via `@huggingface/transformers`（ONNX）              | 多语言（中英混合支持好）；ONNX 本地推理，无需 GPU；1024 维输出                                   |
| Re-ranking | Cross-encoder via `@huggingface/transformers`（ONNX，可选） | 检索后精排，提升 Top-K 质量；按需开启                                                            |
| LLM        | OpenAI SDK（兼容 DeepSeek / OpenAI）                        | OpenAI SDK 支持 baseURL 替换，切换 provider 只需改配置                                           |
| ORM        | Prisma                                                      | 类型安全；schema 即迁移文件；与 NestJS 集成成熟                                                  |
| UI 样式    | Tailwind CSS + shadcn/ui                                    | 无运行时、组件可复制到项目、与 Vite 配合好                                                       |
| 状态管理   | Zustand                                                     | 轻量，适合单用户本地应用                                                                         |
| 部署       | Docker Compose + Supabase Local                             | 一条命令启动全部服务                                                                             |
| Monorepo   | Turborepo + pnpm workspace                                  | 统一管理 web/api/worker 三个应用和共享 packages                                                  |

---

## 1.3 运行时架构

```
┌──────────────────────────────────────────────────────────────────┐
│                         用户浏览器                                │
│                  React + Vite  (dev: :5173)                      │
└────────────────────────────┬─────────────────────────────────────┘
                             │  HTTP / SSE
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                    NestJS API  (:3001)                           │
│   REST 端点 · SSE 流式输出 · OpenAPI spec 自动生成               │
└──────┬─────────────────┬──────────────────────┬──────────────────┘
       │ BullMQ enqueue  │ Prisma               │ OpenAI SDK (HTTP)
       ▼                 ▼                      ▼
┌────────────┐   ┌────────────────────┐   ┌─────────────────────┐
│   Redis    │   │   Supabase Local   │   │    LLM Provider     │
│  BullMQ    │   │                    │   │  DeepSeek / OpenAI  │
│  队列后端  │   │  PostgreSQL        │   └─────────────────────┘
└─────┬──────┘   │  + pgvector        │
      │          │                    │
      │          │  Storage（文件）   │
      │          └──────────┬─────────┘
      │ BullMQ consume      │ Prisma / Storage API
      ▼                     ▼
┌──────────────────────────────────────────────────────────────────┐
│                      BullMQ Worker                               │
│  文档处理：文件读取 → 解析 → Chunking → BGE-M3 → 写入 pgvector   │
│  评估任务：LLM-as-judge 三指标打分（⚠️ D-01：执行位置待决策）     │
└──────────────────────────────────────────────────────────────────┘
```

**进程说明：**

| 进程     | 职责                            | 对外端口                                   |
| -------- | ------------------------------- | ------------------------------------------ |
| web      | React 前端                      | 5173（dev）/ 80（prod）                    |
| api      | NestJS REST API + SSE           | 3001                                       |
| worker   | BullMQ Job 消费者，无 HTTP 接口 | —                                          |
| redis    | BullMQ 队列存储                 | 6379                                       |
| supabase | PostgreSQL + pgvector + Storage | 54321（API）/ 54322（DB）/ 54323（Studio） |

**通信方式：**

- 前端 → API：HTTP REST + SSE（问答流式输出）
- API → Redis：BullMQ enqueue（文档 embedding job、评估 job）
- Worker → Redis：BullMQ consume
- API / Worker → Supabase DB：Prisma（通过 `packages/db` 共享 client）
- API → Supabase Storage：上传用户文件
- Worker → Supabase Storage：读取文件内容进行处理
- API → LLM Provider：OpenAI SDK HTTP 请求（Chat、HyDE）

---

## 1.4 核心流程

### 文档导入流程

```
用户上传文件（TXT / MD）
  │
  ▼
API: 校验文件类型和大小（≤ 10MB）
  │
  ▼
API: 保存文件到 Supabase Storage
  │
  ▼
API: 在 documents 表创建记录（status: pending）
     携带当前 chunking 配置快照（strategy / chunk_size / overlap）
  │
  ▼
API: 向 BullMQ 投递 EmbeddingJob
  │
  ▼
documents.status → processing
  │
  ▼ (Worker 消费)
Worker: 从 Storage 读取文件内容
  │
  ▼
Worker: 文本解析（TXT 直接读取 / MD 去除 Markdown 语法）
  │
  ▼
Worker: Chunking（按 job 中携带的策略：Fixed / Semantic）
  │
  ▼
Worker: BGE-M3 批量 Embedding（embedBatch）
  │
  ▼
Worker: 写入 chunks 表（content + embedding vector）
  │
  ▼
Worker: 更新 documents.status → done，记录 total_chunks、processing_completed_at
```

**异常路径：** Job 失败 → 自动重试（最多 JOB_RETRY_COUNT 次）→ 超出后 status → failed，记录 error_message，用户可手动重试。

---

### 问答查询流程（RAG Pipeline）

```
用户输入问题
  │
  ▼
前端：若 conversationId = null，先 POST /conversations 创建会话
  │
  ▼
POST /conversations/:id/messages  { content: string }
  │
  ▼
API: 保存用户消息（role: user）
  │
  ▼
API: 加载 Settings（动态配置：HyDE、Re-ranking、top_k 等）
  │
  ▼
API: 构造检索 Query
  ├── 从 messages 表加载最近 N 轮历史（N = conversation_history_window ⚠️ D-03）
  ├── 拼接历史上下文构成 augmented query
  └── [若 HyDE 开启] → LLM 生成假设答案 → 替代 augmented query
  │
  ▼
API: BGE-M3 Embedding（embed query）
  │
  ▼
API: pgvector 向量相似度检索（Top-K chunks）
  │
  ▼
[若 Re-ranking 开启]
API: Cross-encoder 对 chunks 重排序
  │
  ▼
API: 组装 Prompt
  ├── system prompt（从 prompt_templates 加载激活模板，否则用默认）
  ├── 对话历史（最近 N 轮）
  ├── retrieved context（chunks 内容）
  └── 用户当前问题
  │
  ▼
API: 调用 LLM（stream）→ SSE 推送给前端
  event: delta   { content: string }        ← 逐 token 推送
  event: done    { messageId, retrievedChunks, latency }
  event: error   { code, message }
  │
  ▼
API: 保存 assistant 消息（content、retrieved_chunks 快照、延迟数据）
  │
  ▼ [若在线评估开启]
API / Worker: 异步触发 EvaluationJob（⚠️ D-01：执行位置待决策）
```

---

### 在线评估流程

```
EvaluationJob 被消费
  │ 输入：messageId, question, answer, retrievedChunks
  ▼
并行调用 LLM-as-judge（三个指标各一次 LLM 调用）
  ├── Faithfulness：答案是否忠于 context，无幻觉
  ├── Answer Relevancy：答案是否回答了问题
  └── Context Precision：检索到的 chunks 是否与问题相关
  │
  ▼
解析 LLM 返回的 JSON（score + reason）
  │
  ▼
写入 evaluations 表（每个指标一行）
  │
  ▼
前端轮询 GET /messages/:id/evaluation
  └── status: pending → completed 后更新消息下方评估面板
```
