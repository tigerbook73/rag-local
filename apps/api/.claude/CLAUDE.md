# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## apps/api — NestJS REST API

### 职责

- REST 端点（`/api/v1`，GlobalPrefix）
- SSE 流式问答（`POST /conversations/:id/messages`）
- OpenAPI spec 自动生成（`@nestjs/swagger`）
- 启动时初始化 EmbeddingService 和 LLMService（通过 `MessagesBootstrapService` 的 `OnApplicationBootstrap` hook）

### 命令

```bash
pnpm dev       # nest start --watch，使用 node --env-file=../../.env（不用 dotenv 包）
pnpm build     # nest build → dist/
pnpm test      # vitest run（spec 文件在 src/**/*.spec.ts）
pnpm test:watch
pnpm lint
pnpm typecheck
pnpm gen:spec  # 构建后执行 node dist/gen-spec.js ../../openapi.json，更新根目录 openapi.json
```

### 模块结构

```
src/
  common/
    env.ts                    # validateEnv（启动时 fail-fast）、getLlmApiKey
    all-exceptions.filter.ts  # 全局 ExceptionFilter，统一错误格式
    prisma.module.ts / .service.ts
    supabase.module.ts        # SUPABASE_CLIENT token，注入 SupabaseClient
  modules/
    health/        # GET /health → { status: 'ok' }
    conversations/ # CRUD
    messages/      # POST（SSE 流式）、GET、PATCH feedback、GET evaluation
    documents/     # 上传（multipart）、列表、删除、重试
    settings/      # GET / PATCH（含 requiresReindex 检测）
  gen-spec.ts      # 生成 OpenAPI JSON 文件的脚本（nest build 后运行）
```

### 关键非默认行为

**启动时初始化（非请求时）：** `MessagesBootstrapService` 实现 `OnApplicationBootstrap`，在应用启动时调用 `EmbeddingService.init()`（加载 BGE-M3 ONNX 模型）和 `LLMService.init()`（从 DB 读 Settings 初始化 OpenAI client）。模型加载完成前不接受问答请求。

**SSE 流式输出格式（手动写入 Response）：**

```
event: delta\ndata: {"content":"..."}\n\n
event: done\ndata: {"messageId":"...","retrievedChunks":[...],"latency":{...}}\n\n
event: error\ndata: {"code":"...","message":"..."}\n\n
```

SSE 在 Controller 中直接操作 `@Res() res: Response`（绕过 NestJS 拦截器），Controller 需标记 `@Header('Content-Type', 'text/event-stream')` 等 SSE 头。

**ValidationPipe 配置：** `transform: true, whitelist: true`（全局，`main.ts` 注册）。

**CORS：** 允许 `CORS_ORIGIN` 环境变量指定的 origin，默认 `http://localhost:5173`。

**Supabase 注入：** `SupabaseModule` 使用 `SUPABASE_CLIENT` symbol 作为 token，`@Inject(SUPABASE_CLIENT)` 注入 `SupabaseClient`，使用 `service_role` key（文件上传/下载需要跳过 RLS）。

**文件上传文件名修复：** multer/busboy 将 Content-Disposition 中的文件名以 Latin-1 解码，需要 `Buffer.from(file.originalname, "latin1").toString("utf8")` 还原 UTF-8 中文文件名。

**Settings 读取：** `SettingsService.getSettings()` 每次查询 DB 全表，无缓存（当前实现简单，未来可加缓存）。LLM model 和 baseUrl 由代码中 `PROVIDER_CONFIG` 映射，不存 DB，换 provider 时由代码逻辑更新。

### 测试配置

使用 `vitest` + `unplugin-swc`（非 Jest），原因是 NestJS decorator metadata 需要 SWC 的 `decoratorMetadata: true` 支持，配置见 `vitest.config.ts`。

测试文件命名：`*.spec.ts`，路径：`src/**/*.spec.ts`。
