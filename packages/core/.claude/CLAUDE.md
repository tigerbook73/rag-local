# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## packages/core — 共享核心逻辑

`api` 和 `worker` 共同引用的纯逻辑包。不依赖 NestJS，主要依赖 `openai`（LLM）和 Node.js 原生 `fetch`（Embedding HTTP 调用）。

### 命令

```bash
pnpm dev       # tsc --watch（输出 dist/）
pnpm build     # tsc（api/worker 的 dev/test 前置依赖）
pnpm typecheck
pnpm lint
```

### 模块说明

**`EmbeddingService`（`src/embedding/embedding.service.ts`）**

- HTTP 客户端，调用 Python embedding sidecar（`EMBEDDING_SERVICE_URL`，默认 `http://localhost:8000`）
- **`init()` 是同步方法**，仅读取环境变量，无模型加载开销
- `embed(text)` → `POST /embed`；`embedBatch(texts)` → 单次 `POST /embed/batch`（非 N 次并行）
- **`init()` 必须在使用 `embed()`/`embedBatch()` 前调用**，否则抛出异常

**`LLMService`（`src/llm/llm.service.ts`）**

- 底层使用 `openai` npm 包，通过 `baseURL` 参数支持 DeepSeek（OpenAI 兼容协议）
- `init(config)` 初始化 client，`reinitialize(config)` 更新配置（Settings 变更时调用，不重启进程）
- `chat()` — 非流式（HyDE、LLM-as-judge）；`stream()` — AsyncGenerator 流式（问答）

**`RetrievalService`（`src/retrieval/retrieval.service.ts`）**

- 依赖 `EmbeddingService` 和 `PrismaLike`（接口，不直接依赖 PrismaClient 类型）
- 向量查询通过 `$queryRawUnsafe` 执行 pgvector cosine similarity，embedding 序列化为 `[x1,...,xN]` 字符串
- 当前实现不含 HyDE 和 Re-ranking（Phase 3 扩展）

**`ChunkingStrategy`（`src/chunking/strategy.ts`）**

- `FixedSizeChunkingStrategy`：字符数滑动窗口，单位为字符（非 token）
- `SemanticChunkingStrategy`：⚠️ **当前 fallback 到 Fixed**（D-04 算法待决策）
- `stripMarkdown(text)`：将 Markdown 语法剥离为纯文本，用于 embedding（chunk 原文保留 Markdown 用于展示）
- `createChunkingStrategy(settings)` — 工厂函数，api 和 worker 统一通过此创建实例

**Job 类型常量（`src/types/jobs.ts`）**

- `EmbeddingJobData`、`EvaluationJobData` — Job payload 类型
- `QUEUE_NAMES` — 常量，api 和 worker 共用，避免字符串硬编码

**共享工具（`src/config/redis.ts`）**

- `parseRedisUrl(url?)` — 将 `REDIS_URL` 解析为 `{ host, port }` BullMQ connection 对象；api、worker、health.service 三处共用，默认 fallback `redis://localhost:6379`

### 发布格式

`"type": "module"`，输出 ESM（tsc 编译为 `dist/`），所有内部 import 带 `.js` 扩展名。消费方通过 `workspace:*` 引用编译产物（`main: ./dist/index.js`），因此 `packages/core` 必须在 dev/build 前先 build（Turborepo `dependsOn: ["^build"]` 保证）。
