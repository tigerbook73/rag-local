# 07 — 基础设施、约束与可观测性

---

## 7.1 系统约束

| 约束项               | 值      | 配置方式                      |
| -------------------- | ------- | ----------------------------- |
| 单文件最大体积       | 10MB    | `MAX_FILE_SIZE_MB` 环境变量   |
| 支持文件类型         | TXT、MD | 硬编码白名单（扩展时修改）    |
| Worker 并发数        | 2       | `WORKER_CONCURRENCY` 环境变量 |
| Job 最大自动重试次数 | 3       | `JOB_RETRY_COUNT` 环境变量    |
| 知识库最大文档数     | 无限制  | 由磁盘空间决定                |

所有约束通过配置项控制，不硬编码业务逻辑。

---

## 7.2 错误处理

### 文档处理失败

1. Job 执行失败 → BullMQ 按 `JOB_RETRY_COUNT` 自动重试
2. 超出重试次数 → `documents.status` 更新为 `failed`，`error_message` 记录最后一次错误
3. UI 展示 failed badge + 错误信息摘要，提供"重试"按钮
4. 用户点击重试 → `POST /documents/:id/retry` → 重置 status 为 pending，重新入队

**部分 Embedding 完成后重试：** Worker 在处理前先清除该文档已有的全部 chunks，再从头开始，保证向量数据一致性。

---

### 系统重启恢复

| 场景                                       | 处理方式                                                                 |
| ------------------------------------------ | ------------------------------------------------------------------------ |
| Redis 未重启                               | `waiting` 状态的 Job 保留在队列，正常处理                                |
| Redis 未重启，Worker 崩溃时有 `active` Job | BullMQ 超时后标记为 `stalled`，自动重试                                  |
| Redis 重启（Job 全部丢失）                 | API/Worker 启动时扫描 DB 中 `status = 'processing'` 的文档，自动重新入队 |

**DB 扫描 Resume 逻辑（启动时执行）：**

```typescript
// 查找所有卡在 processing 状态的文档
const stuckDocs = await prisma.document.findMany({
  where: { status: 'processing' }
});
// 重置状态并重新入队
for (const doc of stuckDocs) {
  await prisma.document.update({ where: { id: doc.id }, data: { status: 'pending' } });
  await embeddingQueue.add('embed', { documentId: doc.id, ... });
}
```

---

### LLM API 调用失败

- **Chat 流式**：向客户端发送 `event: error` 事件，前端展示错误提示，会话不中断（用户可重新提问）
- **HyDE / 评估**：降级处理——HyDE 失败则回退到直接 embed 原始 query；评估失败则跳过，不影响问答
- 所有失败均记录错误日志（含 provider、model、HTTP 状态码）

---

## 7.3 可观测性

### 延迟记录

每次问答将以下数据存入 `messages` 表，可在 History 详情页查看：

| 字段           | 说明                                                     |
| -------------- | -------------------------------------------------------- |
| `ttft_ms`      | 首字延迟：从收到请求到 LLM 返回第一个 token              |
| `total_ms`     | 总响应时间：流式输出完全结束                             |
| `retrieval_ms` | 检索耗时：从 embed query 到拿到最终 chunks（含可选步骤） |

不设定延迟目标，数据用于后续分析和问题排查。

文档处理耗时通过 `processing_started_at` 和 `processing_completed_at` 计算，存在 `documents` 表。

---

### 日志规范

使用结构化日志（JSON 格式），**Pino**（NestJS 兼容，性能高）。api 和 worker 均已通过 **nestjs-pino** 集成，开发环境使用 `pino-pretty` 美化输出，生产环境输出 JSON。

| 级别    | 记录内容                                                                 |
| ------- | ------------------------------------------------------------------------ |
| `info`  | 每次问答请求（query 摘要、retrieved chunks 数、延迟）、文档处理开始/完成 |
| `warn`  | LLM API 重试、Job 重试                                                   |
| `error` | LLM API 最终失败、Job 最终失败（含错误详情）、系统启动异常               |
| `debug` | 检索中间数据（chunks、scores）、完整 Prompt 内容                         |

日志输出到 stdout，Docker 环境下由容器运行时收集，开发环境输出到终端（Pino pretty 格式）。

---

## 7.4 部署（生产/演示）

### Docker Compose 服务清单

```yaml
# docker-compose.yml 结构（示意）
services:
  web:
    build: ./apps/web
    ports: ["80:80"]
    depends_on:
      api:
        condition: service_healthy

  api:
    build: ./apps/api
    ports: ["3001:3001"]
    depends_on:
      redis:
        condition: service_healthy
      supabase:
        condition: service_healthy
      embedding:
        condition: service_healthy
    env_file: .env
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 10s
      timeout: 5s
      retries: 3

  worker:
    build: ./apps/worker
    depends_on:
      redis:
        condition: service_healthy
      supabase:
        condition: service_healthy
      embedding:
        condition: service_healthy
    env_file: .env

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
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 60s

  redis:
    image: redis:7-alpine
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  supabase:
    # 开发环境：通过 supabase CLI（supabase start）管理，不纳入此 compose
    # 生产/演示：引入 Supabase 官方 docker-compose（待 Phase 0 完成后补充）

volumes:
  model-cache: # BGE-M3 模型持久化缓存（embedding sidecar）
  redis-data: # BullMQ 队列持久化
  postgres-data: # PostgreSQL 数据持久化
```

### 首次启动顺序

```
1. supabase（等待 DB 健康检查通过）
2. redis
3. embedding（start_period: 60s，首次启动下载模型需等待）
4. api（启动时运行 Prisma migrate，扫描 stuck documents 重新入队）
5. worker（依赖 redis + supabase + embedding；Prisma migrate 需在 Worker 消费前完成）
6. frontend
```

`depends_on` + `healthcheck` 在 docker-compose.yml 中配置，确保启动顺序。

### 离线评估脚本

DeepEval 离线评估脚本（`eval/`）单独运行，不纳入 Docker Compose 常驻服务：

```bash
cd eval
pip install -r requirements.txt
python evaluate.py --test-set tests/test_set.json --api-url http://localhost:3001
```
