# 08 — 实现阶段与测试策略

---

## 8.1 实现阶段

每个阶段交付可独立端到端验收的垂直切片。

### Phase 1 — 基础 RAG 问答

**包含：**
- DB Schema 初始化（Prisma migrations）
- 文档上传 + 异步 Embedding（Worker + BullMQ）
- 基础向量检索（无 HyDE / Re-ranking）
- Chat 问答（SSE 流式）+ 引用来源
- Knowledge 页面（上传、列表、状态轮询）
- Chat 页面（问答、引用来源展示）
- Docker Compose 完整运行

**验收：** 上传 TXT/MD 文档 → 状态变为 done → 提问 → 流式返回答案 → 展示引用来源

---

### Phase 2 — 会话管理 + 多轮对话

**包含：**
- 多轮对话上下文（History Augmented Query）
- 会话创建 / 切换 / 删除（含 pending 状态逻辑）
- Conversation title 自动填充（截取第一条用户消息）
- History 页面（列表 + 详情）
- 对话历史窗口配置（解决 D-03 后实现）

**验收：** 多轮追问语义连贯 → History 页面可查看历史对话

---

### Phase 3 — 检索增强（HyDE + Re-ranking）

**包含：**
- HyDE（查询前 LLM 生成假设答案）
- Re-ranking（cross-encoder 重排序）
- Settings 页面 Query Tab 动态配置开关

**验收：** HyDE / Re-ranking 开关生效 → Settings 修改后立即应用

---

### Phase 4 — Settings 全功能 + 用户反馈

**包含：**
- Settings 页面 LLM Tab + Indexing Tab
- Prompt 模板管理（创建、激活、删除）
- 多 LLM 切换（DeepSeek / OpenAI）
- 静态配置变更提示重新 Embedding
- 用户反馈（👍/👎）

**验收：** 切换 LLM provider 后问答正常 → 修改 chunk size 后提示重新处理 → 反馈数据存库

---

### Phase 5 — Quality Validation

**前置决策：** D-01（评估执行位置）、D-02（离线评估 UI 是否需要 API）

**包含：**
- 在线评估（LLM-as-judge，三指标，异步）
- 评估结果轮询 + 消息内联展示（评估中 → 分数）
- 检索可观测性数据记录（存 retrieved_chunks + prompt）
- Quality 页面在线评估 Tab
- 离线评估 Python 脚本（DeepEval）+ 测试集 JSON 格式
- Quality 页面离线评估 Tab

**验收：** 开启在线评估 → 问答后出现"评估中"指示器 → 评估完成后显示分数 → 可展开 reason → 离线评估脚本可跑通

---

## 8.2 测试策略

### 工具

| 层级 | 工具 |
|------|------|
| Backend 单元测试 | Jest |
| Frontend 单元测试 | Vitest |
| 集成测试（API） | Jest + Supertest + 真实 DB / Redis |
| E2E | Playwright |

集成测试需要运行中的 Redis 和 Supabase Local，通过 `docker-compose.dev.yml` 提供，CI 环境同样启动这两个服务。

### 覆盖范围

**单元测试（必须覆盖）**
- Chunking：各策略的分段逻辑（边界条件、overlap 处理、空文本）
- Prompt 构建：history + context + question 的拼接顺序和格式
- LLM-as-judge Prompt 解析：score/reason JSON 提取、格式异常降级
- Settings 优先级逻辑：DB 值覆盖 .env 默认值

**集成测试（必须覆盖）**
- 文档上传 → Job 入队 → `documents.status` 变为 processing
- 问答 API：返回 SSE 流，`done` 事件包含 messageId 和 chunks
- 评估轮询 API：pending → completed 状态转换
- Settings PATCH：静态配置变更返回 `requiresReindex: true`
- 文档删除：关联 chunks 同步删除，后续检索不返回该文档内容

**E2E（必须覆盖）**
- 上传文档 → 状态变为 done
- 提问 → 流式回答 → 引用来源展示
- 多轮追问上下文连贯
- 开启在线评估 → 评估结果出现

### 人工验收项

以下内容自动化成本高、收益低，人工验收：
- 流式输出视觉效果（逐字出现的动画）
- 评估"评估中..."动画 → 分数更新过渡效果
- Mobile 布局和 Tab Bar 交互
- 离线评估报告可读性
- Settings 变更提示条显示时机

---

## 8.3 功能验收用例

### AC-01：文档上传处理

```
Given 系统运行正常
When  上传一个 < 10MB 的 .md 文件
Then  文档列表出现该文件，状态为 pending
And   状态在 Worker 处理后变为 done
And   total_chunks 有值
```

### AC-02：基础 FAQ 问答

```
Given 知识库中有处理完成的文档
When  在 Chat 页面输入与文档内容相关的问题
Then  流式返回答案
And   消息下方展示引用来源（文档名 + 段落内容）
```

### AC-03：多轮对话上下文

```
Given 已有一轮问答
When  输入依赖上一轮答案的追问
Then  新答案在语义上与上一轮连贯
```

### AC-04：在线评估

```
Given Settings > Query 中在线评估已开启
When  完成一次问答
Then  消息下方出现"评估中..."指示器
And   评估完成后更新为 F / AR / CP 分数
And   展开后可查看 reason
And   下一个问题可以立即提问，不被评估阻塞
```

### AC-05：系统重启 Resume

```
Given 一个文档正在 processing
When  系统（含 Redis）重启
Then  该文档重新进入队列并继续处理
And   不会产生重复 chunks（旧 chunks 先清除）
```

### AC-06：静态配置变更提示

```
Given 进入 Settings > Indexing
When  修改 chunk size 并保存
Then  页面出现提示：「Chunking 参数已变更，建议对知识库重新 Embedding」
```

### AC-07：文档删除

```
Given 一个状态为 done 的文档
When  点击删除
Then  文档从列表消失
And   该文档的 chunks 和向量同步删除
And   后续问答不再引用该文档内容
```
