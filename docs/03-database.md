# 03 — 数据库设计

数据库：PostgreSQL + pgvector（通过 Supabase Local 提供）。Schema 通过 Prisma Migrate 管理。

---

## 3.1 表关系总览

```
conversations ──< messages ──< evaluations
documents     ──< chunks
settings      (singleton，只有一行)
prompt_templates
```

---

## 3.2 表定义

### `conversations`

```sql
CREATE TABLE conversations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title      TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

> `title` 默认为空，由前端截取第一条用户消息内容自动填充（前 50 字符），通过 PATCH /conversations/:id 更新。

---

### `messages`

```sql
CREATE TYPE message_role     AS ENUM ('user', 'assistant');
CREATE TYPE message_feedback AS ENUM ('positive', 'negative');

CREATE TABLE messages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id   UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role              message_role NOT NULL,
  content           TEXT NOT NULL,
  feedback          message_feedback NULL,       -- 仅 assistant 消息有效
  retrieved_chunks  JSONB NULL,                  -- 检索快照，仅 assistant 消息
  ttft_ms           INTEGER NULL,                -- 首字延迟（ms）
  total_ms          INTEGER NULL,                -- 总响应时间（ms）
  retrieval_ms      INTEGER NULL,                -- 检索耗时（ms）
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
```

**`retrieved_chunks` JSONB 结构：**

```json
[
  {
    "chunk_id": "uuid",
    "document_id": "uuid",
    "document_name": "filename.md",
    "content": "chunk 原文",
    "similarity_score": 0.85,
    "rerank_score": 0.91
  }
]
```

> `rerank_score` 仅在 Re-ranking 开启时有值，否则为 null。

---

### `documents`

```sql
CREATE TYPE document_status   AS ENUM ('pending', 'processing', 'done', 'failed');
CREATE TYPE document_filetype AS ENUM ('txt', 'md');
CREATE TYPE chunking_strategy AS ENUM ('fixed', 'semantic');

CREATE TABLE documents (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename                TEXT NOT NULL,
  file_type               document_filetype NOT NULL,
  storage_path            TEXT NOT NULL,            -- Supabase Storage 中的路径
  status                  document_status NOT NULL DEFAULT 'pending',
  error_message           TEXT NULL,
  -- 以下字段为处理时的 chunking 配置快照（与 settings 解耦，重新 embedding 后更新）
  chunking_strategy       chunking_strategy NOT NULL DEFAULT 'fixed',
  chunk_size              INTEGER NOT NULL,
  chunk_overlap           INTEGER NOT NULL,
  total_chunks            INTEGER NULL,
  processing_started_at   TIMESTAMPTZ NULL,
  processing_completed_at TIMESTAMPTZ NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

> `chunking_strategy / chunk_size / chunk_overlap` 存储该文档**实际处理时**使用的配置快照，不随 settings 变更而更新，便于溯源和对比实验。

---

### `chunks`

```sql
CREATE TABLE chunks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  content      TEXT NOT NULL,
  embedding    VECTOR(1024) NOT NULL,   -- BGE-M3 输出维度
  chunk_index  INTEGER NOT NULL,        -- 在文档中的顺序（0-based）
  metadata     JSONB NULL,              -- 预留，可存页码、标题等
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 向量检索索引（cosine similarity）
CREATE INDEX idx_chunks_embedding ON chunks
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX idx_chunks_document_id ON chunks(document_id);
```

> `lists = 100` 适合数万量级 chunks。数据量增大时可调整，但需重建索引。

---

### `evaluations`

```sql
CREATE TYPE eval_metric AS ENUM (
  'faithfulness',
  'answer_relevancy',
  'context_precision'
);

CREATE TABLE evaluations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  metric     eval_metric NOT NULL,
  score      NUMERIC(3,2) NOT NULL,   -- 0.00 ~ 1.00
  reason     TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_evaluations_message_id ON evaluations(message_id);
```

---

### `settings`（singleton）

```sql
CREATE TYPE llm_provider AS ENUM ('openai', 'deepseek');

CREATE TABLE settings (
  id                          INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  -- LLM
  llm_provider                llm_provider NOT NULL DEFAULT 'deepseek',
  llm_model                   TEXT NOT NULL DEFAULT 'deepseek-chat',
  llm_base_url                TEXT NULL,
  -- 静态配置（变更后需重新 embedding）
  chunking_strategy           chunking_strategy NOT NULL DEFAULT 'fixed',
  chunk_size                  INTEGER NOT NULL DEFAULT 512,
  chunk_overlap               INTEGER NOT NULL DEFAULT 50,
  -- 动态配置（查询时即时生效）
  hyde_enabled                BOOLEAN NOT NULL DEFAULT false,
  reranking_enabled           BOOLEAN NOT NULL DEFAULT false,
  top_k                       INTEGER NOT NULL DEFAULT 5,
  online_evaluation_enabled   BOOLEAN NOT NULL DEFAULT false,
  conversation_history_window INTEGER NOT NULL DEFAULT 50,  -- ⚠️ D-03：单位待决策
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO settings DEFAULT VALUES;
```

---

### `prompt_templates`

```sql
CREATE TABLE prompt_templates (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  content    TEXT NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 保证最多一个模板处于激活状态
CREATE UNIQUE INDEX idx_prompt_templates_active
  ON prompt_templates (is_active)
  WHERE is_active = true;
```

> 激活新模板时，应用层先将其他模板 `is_active` 置 false，再激活新模板（同一事务内完成）。
