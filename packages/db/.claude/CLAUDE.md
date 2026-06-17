# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## packages/db — Prisma Schema + PrismaClient

### 命令

```bash
pnpm db:migrate  # prisma migrate dev（用 dotenv-cli 加载 ../../.env）
pnpm db:seed     # tsx prisma/seed.ts（写入 settings 默认值）
pnpm db:generate # prisma generate（仅重新生成 client，不执行迁移）
pnpm build       # prisma generate && tsc（两步都要，消费方引用 dist/）
pnpm dev         # tsc --watch
pnpm typecheck
pnpm lint
```

### 关键非默认行为

**Prisma Client 输出路径非标准：** schema.prisma 中 `output = "../src/generated/prisma"`（非默认的 `node_modules/@prisma/client`）。所有 import 均从本包路径：

```typescript
// 正确
import { PrismaClient } from "@rag-local/db";
import { PrismaClient } from "./generated/prisma/client.js"; // 包内使用

// 错误 — 不要用
import { PrismaClient } from "@prisma/client";
```

**PrismaClient 单例模式（`src/index.ts`）：** 通过 `globalThis` 防止热重载时多次实例化（开发环境），生产环境创建单次实例。

**`chunks.embedding` 为 `Unsupported` 类型：** schema.prisma 中 `embedding Unsupported("vector(1024)")`，Prisma 不会为此字段生成类型安全方法。涉及 embedding 的操作**必须使用 Raw SQL**：

```typescript
// 写入
await prisma.$executeRawUnsafe(
  `INSERT INTO chunks (id, document_id, content, embedding, chunk_index)
   VALUES (gen_random_uuid(), $1::uuid, $2, $3::vector, $4)`,
  documentId,
  content,
  `[${floats.join(",")}]`,
  index,
);

// 查询
await prisma.$queryRawUnsafe<ChunkRow[]>(
  `SELECT ..., (1 - (c.embedding <=> $1::vector)) AS similarity_score
   FROM chunks c WHERE ... ORDER BY c.embedding <=> $1::vector LIMIT $2`,
  embStr,
  topK,
);
```

**Settings 表设计（key-value 存储）：** `Setting` 模型仅有 `key` 和 `value` 两个字段，设置项以行存储。`SettingsService` 读取全部行组装成 `AppSettings` 对象，新增设置项只需 upsert 新的 key 行，无需加列。

**`db:migrate` 使用 `dotenv-cli`：** 因为 packages/db 目录中没有 `.env` 文件，使用 `dotenv -e ../../.env -- prisma migrate dev` 加载根目录的 `.env`。

**`db:seed` 使用 `tsx`：** seed 文件是 TypeScript（`prisma/seed.ts`），使用 `tsx` 直接执行，无需预编译。

### Schema 要点

- `Setting`：key-value store，`@id` 是 key 字符串
- `Chunk.embedding`：`Unsupported("vector(1024)")`，必须 raw SQL
- `Message.retrievedChunks`：`Json?`，存储检索快照（不随 chunks 变更而变化）
- 所有 UUID 字段标注 `@db.Uuid`，时间戳字段标注 `@db.Timestamptz`
- 字段命名：Prisma 模型用 camelCase，DB 列用 `@map("snake_case")`，表名用 `@@map("snake_case")`

### 发布格式

`"type": "module"`，`build` 先 `prisma generate` 再 `tsc`，消费方引用 `dist/index.js`。`src/generated/` 目录在 `.gitignore` 中，clone 后需运行 `pnpm db:generate` 或 `pnpm build`。
