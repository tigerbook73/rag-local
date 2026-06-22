import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import type { Response } from "express";
import { PrismaService } from "../../common/prisma.service.js";
import { SettingsService } from "../settings/settings.service.js";
import {
  LLMService,
  RetrievalService,
  QUEUE_NAMES,
  type LLMMessage,
  type EvaluationJobData,
} from "@rag-local/core";
import { Prisma } from "@rag-local/db";
import type { SendMessageDto } from "./dto/send-message.dto.js";
import type { UpdateFeedbackDto } from "./dto/update-feedback.dto.js";

const DEFAULT_SYSTEM_PROMPT = `You are a helpful assistant that answers questions based on the provided context.
Answer only from the context. If the context does not contain enough information, say so clearly.
Be concise and accurate.`;

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
    private readonly llmService: LLMService,
    private readonly retrievalService: RetrievalService,
    @InjectQueue(QUEUE_NAMES.EVALUATION) private readonly evalQueue: Queue,
  ) {}

  async findAll(conversationId: string) {
    const data = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
    });
    return { data };
  }

  async streamChat(conversationId: string, dto: SendMessageDto, res: Response): Promise<void> {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { id: true },
    });
    if (!conv) throw new NotFoundException("Conversation not found");

    const settings = await this.settingsService.getSettings();

    const emit = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const llmProvider = this.llmService.getProvider({ provider: settings.llmProvider });
      // Fetch conversation history before saving current user message
      const historyCount = settings.conversationHistoryWindow * 2;
      const historyRows =
        historyCount > 0
          ? await this.prisma.message.findMany({
              where: { conversationId },
              orderBy: { createdAt: "desc" },
              take: historyCount,
              select: { role: true, content: true },
            })
          : [];
      historyRows.reverse();

      this.logger.debug(
        `History: ${historyRows.length} messages (window=${settings.conversationHistoryWindow} rounds) conv=${conversationId}`,
      );

      // Save user message
      await this.prisma.message.create({
        data: { conversationId, role: "user", content: dto.content },
      });

      // Retrieve relevant chunks
      const { chunks, retrievalMs } = await this.retrievalService.retrieve(
        dto.content,
        {
          topK: settings.topK,
          hyde: settings.hydeEnabled,
          reranking: settings.rerankingEnabled,
          rerankTopK: settings.rerankTopK,
          retrievalMode: settings.retrievalMode,
          minSimilarityScore: 0.5,
        },
        llmProvider,
      );

      // Build prompt
      const activeTemplate = await this.prisma.promptTemplate.findFirst({
        where: { isActive: true },
      });
      const systemPrompt = activeTemplate?.content ?? DEFAULT_SYSTEM_PROMPT;

      const contextText = chunks.map((c, i) => `[${i + 1}] ${c.content}`).join("\n\n");

      const history: LLMMessage[] = historyRows.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const messages: LLMMessage[] = [
        { role: "system", content: systemPrompt },
        ...history,
        {
          role: "user",
          content: `Context:\n${contextText}\n\nQuestion: ${dto.content}`,
        },
      ];

      let fullContent = "";
      let ttftMs: number | null = null;
      const startMs = Date.now();

      for await (const token of llmProvider.stream(messages)) {
        if (ttftMs === null) ttftMs = Date.now() - startMs;
        fullContent += token;
        emit("delta", { content: token });
      }

      const totalMs = Date.now() - startMs;

      // Save assistant message with retrieved chunks snapshot and prompt for observability
      const assistantMsg = await this.prisma.message.create({
        data: {
          conversationId,
          role: "assistant",
          content: fullContent,
          retrievedChunks: chunks as unknown as Prisma.InputJsonValue,
          prompt: JSON.stringify(messages),
          ttftMs: ttftMs ?? 0,
          totalMs,
          retrievalMs,
        },
      });

      if (settings.onlineEvaluationEnabled) {
        await this.evalQueue.add(
          "evaluate",
          {
            messageId: assistantMsg.id,
            question: dto.content,
            answer: fullContent,
            retrievedChunks: chunks,
          } satisfies EvaluationJobData,
          { attempts: 2, backoff: { type: "exponential", delay: 3000 } },
        );
        this.logger.debug(`Evaluation job queued for message ${assistantMsg.id}`);
      }

      const latency = { ttftMs: ttftMs ?? 0, totalMs, retrievalMs };
      emit("done", { messageId: assistantMsg.id, retrievedChunks: chunks, latency });
    } catch (err) {
      this.logger.error(
        `streamChat failed [${settings.llmProvider}] conv=${conversationId}: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err.stack : undefined,
      );
      throw err;
    }
  }

  async updateFeedback(messageId: string, dto: UpdateFeedbackDto) {
    const msg = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!msg) throw new NotFoundException("Message not found");
    await this.prisma.message.update({
      where: { id: messageId },
      data: { feedback: dto.feedback },
    });
  }

  async getEvaluation(messageId: string) {
    const evaluations = await this.prisma.evaluation.findMany({
      where: { messageId },
    });
    if (evaluations.length === 0) return { status: "pending" };
    return {
      status: "completed",
      evaluations: evaluations.map((e) => ({
        metric: e.metric,
        score: Number(e.score),
        reason: e.reason,
      })),
    };
  }
}
