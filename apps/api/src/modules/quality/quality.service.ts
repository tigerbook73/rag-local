import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service.js";
import type { EvaluationListQueryDto, BeirRunListQueryDto } from "./dto/quality.dto.js";

@Injectable()
export class QualityService {
  constructor(private readonly prisma: PrismaService) {}

  async listEvaluations(query: EvaluationListQueryDto) {
    const { conversationId, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    // Find assistant messages that have evaluations
    const where = conversationId ? { conversationId } : {};

    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { ...where, role: "assistant", evaluations: { some: {} } },
        include: {
          evaluations: true,
          conversation: { select: { title: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.message.count({
        where: { ...where, role: "assistant", evaluations: { some: {} } },
      }),
    ]);

    // Find the preceding user message for each assistant message
    const questionMap = await this.buildQuestionMap(messages.map((m) => m.id));

    const data = messages.map((msg) => ({
      messageId: msg.id,
      conversationId: msg.conversationId,
      conversationTitle: msg.conversation.title || undefined,
      question: questionMap.get(msg.id),
      evaluations: msg.evaluations.map((e) => ({
        metric: e.metric,
        score: Number(e.score),
        reason: e.reason,
      })),
      createdAt: msg.createdAt.toISOString(),
    }));

    return { data, total };
  }

  private async buildQuestionMap(messageIds: string[]): Promise<Map<string, string>> {
    if (messageIds.length === 0) return new Map();

    // For each assistant message, find the closest preceding user message in the same conversation
    const assistantMsgs = await this.prisma.message.findMany({
      where: { id: { in: messageIds } },
      select: { id: true, conversationId: true, createdAt: true },
    });

    const map = new Map<string, string>();
    await Promise.all(
      assistantMsgs.map(async (msg) => {
        const userMsg = await this.prisma.message.findFirst({
          where: {
            conversationId: msg.conversationId,
            role: "user",
            createdAt: { lt: msg.createdAt },
          },
          orderBy: { createdAt: "desc" },
          select: { content: true },
        });
        if (userMsg) map.set(msg.id, userMsg.content);
      }),
    );

    return map;
  }

  async listBeirRuns(query: BeirRunListQueryDto) {
    const { dataset, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;
    const where = dataset ? { dataset } : {};

    const [runs, total] = await Promise.all([
      this.prisma.beirEvalRun.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.beirEvalRun.count({ where }),
    ]);

    const data = runs.map((r) => ({
      id: r.id,
      dataset: r.dataset,
      embeddingConfig: r.embeddingConfig,
      sampleSize: r.sampleSize,
      metrics: r.metrics as { ndcg10: number; recall10: number; recall100: number; mrr10: number },
      createdAt: r.createdAt.toISOString(),
    }));

    return { data, total };
  }

  async sampleBeirQueries(
    count: number,
  ): Promise<{ data: { id: string; dataset: string; text: string }[] }> {
    const rows = await this.prisma.$queryRawUnsafe<{ id: string; dataset: string; text: string }[]>(
      `SELECT id::text, dataset, text FROM beir_queries
       WHERE LENGTH(text) > 30
         AND array_length(string_to_array(trim(text), ' '), 1) > 4
       ORDER BY RANDOM() LIMIT $1`,
      count,
    );
    return { data: rows };
  }

  async getBeirRunDetail(id: string) {
    const run = await this.prisma.beirEvalRun.findUnique({
      where: { id },
      include: { queryDetails: true },
    });
    if (!run) throw new NotFoundException("BEIR run not found");

    return {
      id: run.id,
      dataset: run.dataset,
      embeddingConfig: run.embeddingConfig,
      sampleSize: run.sampleSize,
      metrics: run.metrics,
      details: run.queryDetails.map((d) => ({
        queryId: d.queryId,
        queryText: d.queryText,
        hits: d.hits,
        ndcg10: Number(d.ndcg10),
        relevantInTop10: d.relevantInTop10,
      })),
      createdAt: run.createdAt.toISOString(),
    };
  }
}
