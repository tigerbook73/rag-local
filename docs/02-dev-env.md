# 02 — 开发环境

---

## 2.1 项目结构（Monorepo）

```
rag-faq/
├── turbo.json
├── package.json                  # pnpm root workspace
├── .env.example                  # 所有环境变量模板，提交到版本控制
├── .env                          # 实际配置，不提交（gitignore）
├── .model-cache/                 # BGE-M3 模型本地缓存，不提交（gitignore）
├── docker-compose.yml            # 生产/演示：全服务编排
├── docker-compose.dev.yml        # 开发：仅启动 Redis
│
├── apps/
│   ├── web/                      # React 前端（Vite）
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   ├── components/
│   │   │   ├── stores/           # Zustand stores
│   │   │   ├── hooks/            # React Query hooks（手写，引用生成类型）
│   │   │   ├── types/
│   │   │   │   └── api.ts        # openapi-typescript 生成，勿手动编辑
│   │   │   └── lib/
│   │   ├── vite.config.ts
│   │   └── package.json
│   │
│   ├── api/                      # NestJS API
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── conversations/
│   │   │   │   ├── messages/
│   │   │   │   ├── documents/
│   │   │   │   ├── settings/
│   │   │   │   ├── quality/
│   │   │   │   └── prompt-templates/
│   │   │   ├── common/
│   │   │   └── main.ts
│   │   └── package.json
│   │
│   └── worker/                   # BullMQ Worker（独立进程）
│       ├── src/
│       │   ├── processors/
│       │   │   └── embedding.processor.ts
│       │   └── main.ts
│       └── package.json
│
├── packages/
│   ├── core/                     # 共享核心逻辑
│   │   ├── src/
│   │   │   ├── chunking/
│   │   │   ├── embedding/
│   │   │   ├── llm/
│   │   │   ├── retrieval/
│   │   │   └── evaluation/
│   │   └── package.json
│   │
│   └── db/                       # Prisma schema + 生成的 client
│       ├── prisma/
│       │   └── schema.prisma
│       ├── src/
│       │   └── client.ts         # Prisma client 单例
│       └── package.json
│
└── eval/                         # DeepEval 离线评估脚本（Python，独立运行）
    ├── tests/
    │   └── test_set.json
    ├── evaluate.py
    └── requirements.txt
```

---

## 2.2 开发环境启动

开发环境分两层：基础设施用容器，应用进程在宿主机直接运行。

### 启动基础设施

```bash
# 1. Supabase Local（管理自己的内部容器组，不纳入项目 docker-compose）
supabase start

# 2. Redis（通过项目 docker-compose.dev.yml 启动）
docker compose -f docker-compose.dev.yml up -d
```

Supabase 启动后会输出各服务地址，将 DB URL、API URL、Service Key 填入 `.env`。

### 数据库初始化

```bash
# 首次或 schema 变更后运行
pnpm db:migrate    # → prisma migrate dev（在 packages/db 中执行）
```

### 启动应用进程

```bash
pnpm dev           # Turborepo 并行启动 web + api + worker
```

Turborepo 根据 `turbo.json` 中的 `dependsOn` 保证 `packages/core` 和 `packages/db` 先 build，再启动三个应用进程。日志合并输出，带进程前缀区分。

---

## 2.3 Turborepo 配置

```json
// turbo.json
{
  "tasks": {
    "build":     { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "dev":       { "persistent": true, "cache": false },
    "test":      { "dependsOn": ["^build"] },
    "gen:types": { "cache": false },
    "db:migrate": { "cache": false }
  }
}
```

**`gen:types` — 前端类型生成**（需 API 已在运行）：

```bash
pnpm gen:types
# 等价于：
# openapi-typescript http://localhost:3001/api-json -o apps/web/src/types/api.ts
```

生成文件 `apps/web/src/types/api.ts` 纳入版本控制，CI 构建前端无需启动 API。

---

## 2.4 BGE-M3 模型管理

| 环境 | 策略 |
|------|------|
| 开发（宿主机） | Worker 首次运行时从 HuggingFace Hub 自动下载，缓存至项目根 `.model-cache/`（加入 `.gitignore`） |
| 生产/演示（Docker） | Worker 容器通过命名卷 `model-cache` 持久化；首次启动自动下载（~570MB），容器重建后缓存保留 |

不将模型预打包进 Docker 镜像，避免镜像体积膨胀。

```yaml
# docker-compose.yml 中 Worker 相关配置（片段）
services:
  worker:
    volumes:
      - model-cache:/app/.model-cache
    environment:
      - HF_HOME=/app/.model-cache

volumes:
  model-cache:
```

开发环境通过 `.env` 设置相同路径：

```
HF_HOME=./.model-cache
```

---

## 2.5 环境变量配置

所有配置通过 `.env` 文件管理，提交 `.env.example` 作为模板。

| 变量 | 示例值 | 说明 |
|------|--------|------|
| `LLM_API_KEY` | `sk-...` | LLM provider API Key |
| `LLM_BASE_URL` | `https://api.deepseek.com` | LLM base URL，切换 provider 只改这里 |
| `LLM_MODEL` | `deepseek-chat` | 默认模型名 |
| `REDIS_URL` | `redis://localhost:6379` | BullMQ 连接 |
| `SUPABASE_URL` | `http://localhost:54321` | Supabase Local API URL |
| `SUPABASE_SERVICE_KEY` | `eyJ...` | service_role key，Worker 直接操作 DB 需要 |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:54322/postgres` | Prisma 连接字符串 |
| `WORKER_CONCURRENCY` | `2` | 同时处理的 Embedding Job 数量 |
| `MAX_FILE_SIZE_MB` | `10` | 单文件最大体积限制 |
| `JOB_RETRY_COUNT` | `3` | Job 最大自动重试次数 |
| `HF_HOME` | `./.model-cache` | HuggingFace 模型缓存目录 |

### 配置优先级

```
Settings UI（存 DB）> .env > 代码默认值
```

LLM 相关配置（model、baseURL）在 Settings UI 中保存后存入 `settings` 表，运行时读取 DB 值，`.env` 中的同名变量作为初始默认值和兜底。Chunking 等静态配置同理。
