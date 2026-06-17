# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

基于 RAG 的本地 FAQ 问答系统。**单用户、本地部署、无 LangChain**，所有 RAG 步骤自实现。

Monorepo 结构（Turborepo + pnpm workspace）：

- `apps/api` — NestJS REST API + SSE 流式问答
- `apps/web` — React + Vite 前端
- `apps/worker` — NestJS BullMQ Worker（**无 HTTP 接口**）
- `packages/core` — 共享核心逻辑（Chunking / Embedding / LLM / Retrieval）
- `packages/db` — Prisma schema + PrismaClient 单例

设计文档完整存放于 `docs/`，包括 DB schema、API 契约、模块接口设计、实现阶段和验收用例，**修改任何核心设计前先查阅对应文档**。

---

## 常用命令

```bash
# 启动基础设施（开发环境）
supabase start
docker compose -f docker-compose.dev.yml up -d

# 数据库迁移（packages/db 中执行，自动加载 ../../.env）
pnpm db:migrate

# 全量启动（Turborepo 并行）
pnpm dev

# 构建、Lint、类型检查
pnpm build
pnpm lint
pnpm typecheck

# 运行所有测试（各 package 并行）
pnpm test

# 单独运行某个 package 的测试
pnpm --filter @rag-local/api test
pnpm --filter @rag-local/web test
pnpm --filter @rag-local/worker test

# E2E 测试（需先启动服务）
pnpm test:e2e

# 前端 API 类型生成（需 API 进程在运行）
pnpm gen:types
# 生成 apps/web/src/types/api.ts，已纳入版本控制，勿手动编辑

# 生产环境（全服务）
docker compose up --wait
```

---

## 架构关键点

### 进程模型

三个独立进程共享 `packages/core` 和 `packages/db`：

```
web (5173) ──HTTP/SSE──▶ api (3001) ──BullMQ──▶ redis (6379)
                              │                       │
                              ▼                       ▼
                        supabase (54321)          worker (无端口)
                        PostgreSQL + pgvector
                        Storage
```

**Worker 没有 HTTP 接口**，使用 `NestFactory.createApplicationContext` 而非 `NestFactory.create`，纯 BullMQ 消费者进程。

### Settings 表实现

`settings` 表是**键值对存储**（每条设置一行 `key/value`），不是单行多列。`SettingsService.getSettings()` 读取所有行并组装成 `AppSettings` 对象。LLM 的 `model` 和 `baseUrl` 由代码内 `PROVIDER_CONFIG` 根据 `llmProvider` 派生，不存入 DB。

### pgvector 操作必须用 Raw SQL

`chunks.embedding` 字段类型为 `Unsupported("vector(1024)")`，Prisma 不生成类型安全的方法。所有向量操作必须使用 `$queryRawUnsafe` 或 `$executeRawUnsafe`，向量值序列化格式为 `[x1,x2,...,x1024]` 字符串。

### API 类型共享工作流

```
NestJS DTO（class-validator 装饰器）
  → OpenAPI spec（/api-json）
  → openapi-typescript 生成 apps/web/src/types/api.ts（已提交，勿手动改）
  → 前端 import 类型
```

变更 DTO 后：重启 API → `pnpm gen:types` → 更新前端 hook。

### 文档 Embedding 区分 chunk 内容和 embed 文本

MD 文件：chunk 的 `content` 字段保存**原始 Markdown**（用于引用来源展示），但写入 pgvector 前先 `stripMarkdown()` 去除语法再 embed。TXT 文件直接 embed 原文。

---

## 非默认行为速查

| 场景              | 实现选择                                                                                 |
| ----------------- | ---------------------------------------------------------------------------------------- |
| 环境变量加载      | `node --env-file=../../.env`（无 dotenv 包），`packages/db` 用 `dotenv-cli`              |
| NestJS 测试       | Vitest + `unplugin-swc`（处理 decorator metadata），不用 Jest                            |
| Tailwind CSS      | v4（`@tailwindcss/vite` 插件，无 `tailwind.config.js`）                                  |
| ESLint            | v9 flat config（`eslint.config.js`，`tseslint.config()`）                                |
| Git hooks         | Lefthook（非 Husky），配置在根目录 `lefthook.yml`                                        |
| Prisma 输出路径   | `packages/db/src/generated/prisma/`（非默认 `@prisma/client`），import 须带 `.js` 扩展名 |
| 会话创建          | 懒创建：用户发第一条消息时前端调 `POST /conversations`，URL 更新为 `/chat/:id`           |
| Semantic Chunking | 当前 fallback 到 Fixed（D-04 待决策），两者行为相同                                      |
| 中文文件名上传    | `Buffer.from(file.originalname, "latin1").toString("utf8")` 修复 busboy 的 Latin-1 解码  |
| Worker 重启恢复   | API 启动时扫描 `status = 'processing'` 的文档，重置并重新入队                            |

---

## 待决策项（影响实现）

| ID   | 问题                                                   | 影响                                    |
| ---- | ------------------------------------------------------ | --------------------------------------- |
| D-01 | 评估 Job 在 Worker 还是 API 内异步执行                 | Phase 5 EvaluationJob 路由              |
| D-03 | `conversation_history_window` 单位（条消息 vs 对话轮） | Phase 2 多轮上下文构建                  |
| D-04 | Semantic Chunking 具体算法                             | Phase 3 `SemanticChunkingStrategy` 实现 |

---

## 配置优先级

```
Settings UI（存 DB）> 代码内默认值
```

LLM API Key 从环境变量读取（`DEEPSEEK_API_KEY` 或 `OPENAI_API_KEY`），不存 DB。

必填环境变量（API 启动时校验，缺失则 fail-fast）：
`DATABASE_URL`、`REDIS_URL`、`SUPABASE_URL`、`SUPABASE_SERVICE_KEY`
