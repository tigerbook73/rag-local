import { Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import { PrismaClient } from "@rag-local/db";
import {
  EvaluationService,
  LLMService,
  type EvaluationJobData,
  QUEUE_NAMES,
} from "@rag-local/core";

@Processor(QUEUE_NAMES.EVALUATION, { concurrency: 2 })
export class EvaluationProcessor extends WorkerHost {
  private readonly logger = new Logger(EvaluationProcessor.name);
  private readonly prisma = new PrismaClient();
  private readonly evaluationService = new EvaluationService(new LLMService());

  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }

  async process(job: Job<EvaluationJobData>): Promise<void> {
    const { messageId, question, answer, retrievedChunks } = job.data;
    this.logger.log(`Evaluating message ${messageId}`);

    const results = await this.evaluationService.evaluate({ question, answer, retrievedChunks });

    await this.prisma.evaluation.createMany({
      data: results.map((r) => ({
        messageId,
        metric: r.metric,
        score: r.score,
        reason: r.reason,
      })),
    });

    this.logger.log(
      `Evaluation done for ${messageId}: F=${results[0]?.score} AR=${results[1]?.score} CP=${results[2]?.score}`,
    );
  }
}
