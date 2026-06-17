# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## apps/worker — NestJS BullMQ Worker

### 职责

- 消费 `embedding` 队列的 Job：文件下载 → 解析 → Chunking → BGE-M3 Embedding → 写入 chunks 表
- 维护自己的 EmbeddingService 实例（独立于 api 进程），模型在 `onModuleInit` 时加载

### 关键非默认行为

**无 HTTP 接口：** Worker 使用 `NestFactory.createApplicationContext`（非 `NestFactory.create`），不启动 HTTP 服务器，不监听端口。这是 NestJS 的 "application context" 模式，仅用于依赖注入和生命周期管理。

**PrismaClient 直接实例化：** `EmbeddingProcessor` 中 `new PrismaClient()` 直接创建，不通过 `PrismaModule` 注入（Worker 模块没有引入 PrismaModule）。`onModuleDestroy` 中调用 `prisma.$disconnect()`。

**Supabase 直接创建：** Worker 中 `createClient()` 直接调用，不经过 NestJS 模块，使用 `SUPABASE_SERVICE_KEY`（绕过 RLS）。

**Embedding 模型加载时机：** `EmbeddingProcessor.onModuleInit()` 时调用 `embeddingService.init()`，首次运行会从 HuggingFace Hub 下载 BGE-M3 ONNX 模型（~570MB），缓存至 `HF_HOME`（开发：`.model-cache/`，Docker：命名卷 `model-cache`）。

**re-embedding 幂等性：** Worker 处理前先 `DELETE FROM chunks WHERE document_id = $1::uuid` 清除旧向量，保证重试不产生重复 chunks。使用 `$executeRawUnsafe`（pgvector 字段无 Prisma 类型支持）。

**向量写入：** chunks 表的 embedding 列为 `vector(1024)`，必须用 `$executeRawUnsafe` + `$3::vector` 转换，向量序列化为 `[x1,...,x1024]` 字符串。

**并发控制：** `@Processor` 装饰器的 `concurrency` 选项，值来自 `WORKER_CONCURRENCY` 环境变量（默认 2）。

**MD 文件 Embedding：** chunk 的 `content` 字段存原始 Markdown（给引用来源展示用），但送入 `EmbeddingService.embed()` 前调用 `stripMarkdown()` 清理语法。TXT 直接 embed 原文。

**Job 失败处理：** `process()` 抛出异常后 BullMQ 按 `attempts`（`JOB_RETRY_COUNT` 次，指数退避 5s）自动重试，超出后 document status 停在 `failed`，用户可手动重试。

### 命令

```bash
pnpm dev       # nest start --watch，--env-file=../../.env
pnpm build     # nest build
pnpm test      # vitest run（unplugin-swc 处理 decorator）
pnpm typecheck
pnpm lint
```

### 测试配置

同 api：vitest + `unplugin-swc`（需要 decorator metadata）。现有测试：`noop.processor.spec.ts`（BullMQ 连接 + 入队/消费验证）。
