# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## apps/web — React + Vite 前端

### 命令

```bash
pnpm dev        # Vite dev server，端口 5173
pnpm build      # tsc && vite build
pnpm test       # vitest run（jsdom 环境，Testing Library）
pnpm test:watch
pnpm test:e2e   # Playwright（需服务运行，或 playwright 自动启动 pnpm dev）
pnpm typecheck
pnpm lint
pnpm preview    # 预览构建产物
```

### 关键配置

**Vite 代理：** `vite.config.ts` 中 `/api` 代理到 `http://localhost:3001`，因此前端代码中 API 调用写 `/api/v1/...` 即可，无需写完整 URL。

**Path alias：** `@` 映射到 `src/`（`vite.config.ts` 和 `tsconfig.json` 均已配置），shadcn/ui 组件路径为 `@/components/ui/...`。

**Tailwind CSS v4：** 通过 `@tailwindcss/vite` 插件（无 `tailwind.config.js`），在 `src/index.css` 中 `@import "tailwindcss"` 引入。shadcn/ui 的 CSS variables（`--background`、`--primary` 等）在 `index.css` 中定义。

### 状态管理架构

前端同时使用两套状态：

- **Zustand** (`src/stores/conversation.store.ts`)：管理当前活跃会话的实时状态（conversationId、messages 数组、streaming token 拼接）。SSE 流式接收时通过 `appendStreamToken` 累积内容，`finalizeStream` 时将完整 assistant 消息写入 messages 数组。
- **TanStack Query** (`src/lib/queryClient.ts`)：管理服务端数据请求（文档列表、历史会话等）。`staleTime: 30_000`，`retry: 1`。

### API 类型文件

`src/types/api.ts` 由 `openapi-typescript` 从 OpenAPI spec 自动生成，**已纳入版本控制，不得手动编辑**。

变更 API 后更新步骤：重启 API → `pnpm gen:types`（根目录）。

手写 API 调用函数在 `src/lib/api.ts`，import 类型来自 `src/types/api.ts`。

### SSE 流式解析

`src/lib/api.ts` 中 `streamChat()` 函数手动解析 SSE 流（`ReadableStream + TextDecoder`），不使用 `EventSource`（原因：`POST` 请求不支持原生 `EventSource`）。事件格式：`event: <type>\ndata: <json>\n\n`。

### 会话创建逻辑

进入 `/chat` 时 `conversationId = null`（pending 状态）。发送第一条消息时：

1. `POST /conversations` 创建会话
2. URL 更新为 `/chat/:id`
3. 异步 `PATCH /conversations/:id` 设置 title（取消息前 50 字符）

"新建对话"仅调用 `resetConversation()`，不请求 API。

### 路由结构

```
/          → redirect /chat
/chat      → ChatPage（pending 状态）
/chat/:id  → ChatPage（绑定指定会话）
/knowledge → KnowledgePage
/history   → HistoryPage（列表）
/history/:id → HistoryPage（详情）
/quality   → QualityPage
/settings/* → SettingsPage（子路由由 Settings 内部 Tab 处理）
```

所有路由在 `RootLayout` 内渲染（Desktop Sidebar + Mobile 底部 Tab Bar）。

### 测试配置

- 单元测试：vitest + jsdom + Testing Library，setup 文件 `src/test/setup.ts`
- E2E：Playwright，仅 Chromium，配置见 `playwright.config.ts`，baseURL `http://localhost:5173`
- 测试文件：`src/**/*.spec.{ts,tsx}`（单元），`e2e/**/*.spec.ts`（E2E）

### shadcn/ui 使用方式

组件复制到 `src/components/ui/`（不是 npm 包），通过 `@/components/ui/<component>` 导入，按需添加。新增组件用 `npx shadcn@latest add <component>` 自动处理依赖和文件。
