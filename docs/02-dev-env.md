# 02 — 开发环境

---

## 2.1 项目结构（Monorepo）

```
rag-faq/
├── turbo.json
├── package.json                  # pnpm root workspace
├── .env.example                  # 所有环境变量模板，提交到版本控制
├── .env                          # 实际配置，不提交（gitignore）
├── docker-compose.yml            # 生产/演示：全服务编排
├── docker-compose.dev.yml        # 开发：Redis + embedding sidecar
│
├── services/
│   └── embedding/                # Python FastAPI embedding sidecar（BGE-M3 on GPU）
│       ├── main.py
│       ├── requirements.txt
│       └── Dockerfile
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
│   └── worker/                   # NestJS BullMQ Worker（独立进程，无 HTTP）
│       ├── src/
│       │   ├── processors/
│       │   │   ├── embedding.processor.ts
│       │   │   └── health.processor.ts
│       │   ├── app.module.ts
│       │   └── main.ts
│       └── package.json
│
├── packages/
│   ├── core/                     # 共享核心逻辑
│   │   ├── src/
│   │   │   ├── chunking/
│   │   │   ├── config/           # parseRedisUrl 等共享工具
│   │   │   ├── embedding/
│   │   │   ├── llm/
│   │   │   ├── retrieval/
│   │   │   └── evaluation/
│   │   └── package.json
│   │
│   └── db/                       # Prisma schema + 生成的 client（ESM package）
│       ├── prisma/
│       │   └── schema.prisma
│       ├── src/
│       │   ├── generated/prisma/ # Prisma 生成的 client（git-ignored）
│       │   └── index.ts          # PrismaClient 单例导出
│       ├── dist/                 # tsc 编译产物（git-ignored）
│       └── package.json          # "type": "module"
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

# 2. Redis + Embedding Sidecar（BGE-M3 on GPU）
docker compose -f docker-compose.dev.yml up -d
```

`docker-compose.dev.yml` 包含两个服务：`redis`（BullMQ）和 `embedding`（Python FastAPI，端口 8000）。首次启动 embedding 服务时会从 HuggingFace Hub 下载 BGE-M3 模型（~1.5GB），缓存至命名卷 `model-cache`，后续重启秒级完成。

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
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "dev": { "dependsOn": ["^build"], "persistent": true, "cache": false },
    "test": { "dependsOn": ["^build"] },
    "gen:types": { "cache": false },
    "db:migrate": { "cache": false }
  }
}
```

**`gen:types` — 前端类型生成**：

```bash
pnpm gen:types
# 构建 API，通过 stdout 生成 OpenAPI spec，并写入 apps/web/src/types/generated/api.ts
```

生成文件 `apps/web/src/types/generated/api.ts` 纳入版本控制；`apps/web/src/types/index.ts` 是前端稳定类型入口。

---

## 2.4 BGE-M3 模型管理（Python Embedding Sidecar）

Embedding 由独立的 Python FastAPI 服务（`services/embedding/`）负责，运行 BGE-M3（`BAAI/bge-m3`，1024 维）on PyTorch + CUDA。Node.js 进程（API、Worker）不再直接加载模型，而是通过 HTTP 调用 sidecar。

| 环境                | 策略                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 开发（Docker）      | `docker compose -f docker-compose.dev.yml up embedding`；首次启动下载 BGE-M3（~1.5GB），缓存至命名卷 `model-cache` |
| 生产/演示（Docker） | 同 docker-compose.dev.yml 结构，GPU reservation 通过 `deploy.resources.reservations.devices` 声明                  |

不将模型预打包进 Docker 镜像，避免镜像体积膨胀。

```yaml
# docker-compose.dev.yml — embedding sidecar 配置（片段）
services:
  embedding:
    build: ./services/embedding
    ports: ["8000:8000"]
    volumes:
      - model-cache:/root/.cache/huggingface
    environment:
      - HF_HOME=/root/.cache/huggingface
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
volumes:
  model-cache:
```

健康检查接口：`GET http://localhost:8000/health` → `{ "status": "ok", "model": "BAAI/bge-m3", "device": "cuda:0" }`

---

## 2.5 环境变量配置

所有配置通过 `.env` 文件管理，提交 `.env.example` 作为模板。

| 变量                    | 示例值                                                    | 说明                                              |
| ----------------------- | --------------------------------------------------------- | ------------------------------------------------- |
| `DEEPSEEK_API_KEY`      | `sk-...`                                                  | DeepSeek API Key                                  |
| `OPENAI_API_KEY`        | `sk-...`                                                  | OpenAI API Key（二选一）                          |
| `REDIS_URL`             | `redis://localhost:6379`                                  | BullMQ 连接                                       |
| `SUPABASE_URL`          | `http://localhost:54321`                                  | Supabase Local API URL                            |
| `SUPABASE_SERVICE_KEY`  | `eyJ...`                                                  | service_role key，Worker 直接操作 DB 需要         |
| `DATABASE_URL`          | `postgresql://postgres:postgres@localhost:54322/postgres` | Prisma 连接字符串                                 |
| `WORKER_CONCURRENCY`    | `2`                                                       | 同时处理的 Embedding Job 数量                     |
| `MAX_FILE_SIZE_MB`      | `10`                                                      | 单文件最大体积限制                                |
| `JOB_RETRY_COUNT`       | `3`                                                       | Job 最大自动重试次数                              |
| `EMBEDDING_SERVICE_URL` | `http://localhost:8000`                                   | Python embedding sidecar 地址（替代原 `HF_HOME`） |

### 配置优先级

```
Settings UI（存 DB）> .env > 代码默认值
```

LLM 相关配置（model、baseURL）在 Settings UI 中保存后存入 `settings` 表，运行时读取 DB 值，`.env` 中的同名变量作为初始默认值和兜底。Chunking 等静态配置同理。

---

## 2.6 工具链

| 工具       | 用途                                                                       | 配置文件               |
| ---------- | -------------------------------------------------------------------------- | ---------------------- |
| Prettier   | 代码格式化（双引号、有分号、2 空格缩进）                                   | `.prettierrc`          |
| ESLint     | 逻辑规则检查；通过 `eslint-config-prettier` 关闭与 Prettier 冲突的格式规则 | `eslint.config.js`     |
| Lefthook   | Git hook 管理（pre-commit 跑 lint + typecheck，commit-msg 跑 commitlint）  | `lefthook.yml`         |
| commitlint | Commit message 格式校验（Conventional Commits，含 scope）                  | `commitlint.config.js` |

Lefthook 相比 Husky 无需 `postinstall` 脚本，在 pnpm monorepo 中配置更简洁；`lefthook.yml` 位于项目根目录。

**常用命令：**

```bash
pnpm lint        # ESLint 检查（Turborepo 并行跑各 package）
pnpm format      # Prettier 格式化
pnpm typecheck   # tsc --noEmit（各 package 独立执行）
```
