import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { Response } from "express";
import { PrismaService } from "../../common/prisma.service.js";
import { SettingsService } from "../settings/settings.service.js";
import { EmbeddingService, LLMService, RetrievalService, type LLMMessage } from "@rag-local/core";
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
    private readonly embeddingService: EmbeddingService,
    private readonly llmService: LLMService,
    private readonly retrievalService: RetrievalService,
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
      // Save user message
      await this.prisma.message.create({
        data: { conversationId, role: "user", content: dto.content },
      });

      // Retrieve relevant chunks
      const { chunks, retrievalMs } = await this.retrievalService.retrieve(dto.content, {
        topK: settings.topK,
      });

      // Build prompt
      const activeTemplate = await this.prisma.promptTemplate.findFirst({
        where: { isActive: true },
      });
      const systemPrompt = activeTemplate?.content ?? DEFAULT_SYSTEM_PROMPT;

      const contextText = chunks.map((c, i) => `[${i + 1}] ${c.content}`).join("\n\n");

      const messages: LLMMessage[] = [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Context:\n${contextText}\n\nQuestion: ${dto.content}`,
        },
      ];

      let fullContent = "";
      let ttftMs: number | null = null;
      const startMs = Date.now();

      for await (const token of this.llmService.stream(messages)) {
        if (ttftMs === null) ttftMs = Date.now() - startMs;
        fullContent += token;
        emit("delta", { content: token });
      }

      const totalMs = Date.now() - startMs;

      // Save assistant message with retrieved chunks snapshot
      const assistantMsg = await this.prisma.message.create({
        data: {
          conversationId,
          role: "assistant",
          content: fullContent,
          retrievedChunks: chunks as unknown as Prisma.InputJsonValue,
          ttftMs: ttftMs ?? 0,
          totalMs,
          retrievalMs,
        },
      });

      const latency = { ttftMs: ttftMs ?? 0, totalMs, retrievalMs };
      emit("done", { messageId: assistantMsg.id, retrievedChunks: chunks, latency });
    } catch (err) {
      this.logger.error(
        `streamChat failed [${settings.llmProvider}/${settings.llmModel}] conv=${conversationId}: ${err instanceof Error ? err.message : String(err)}`,
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
