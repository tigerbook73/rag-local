import { Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@rag-local/db";
import {
  EmbeddingService,
  createChunkingStrategy,
  stripMarkdown,
  type EmbeddingJobData,
  QUEUE_NAMES,
} from "@rag-local/core";

@Processor(QUEUE_NAMES.EMBEDDING, {
  concurrency: Number(process.env["WORKER_CONCURRENCY"] ?? 2),
})
export class EmbeddingProcessor extends WorkerHost {
  private readonly logger = new Logger(EmbeddingProcessor.name);
  private readonly prisma = new PrismaClient();
  private readonly supabase = createClient(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_SERVICE_KEY"]!,
  );
  private readonly embeddingService = new EmbeddingService();

  onModuleInit() {
    void this.embeddingService.init();
    this.logger.log(
      `Embedding service connected: ${process.env["EMBEDDING_SERVICE_URL"] ?? "http://localhost:8000"}`,
    );
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }

  async process(job: Job<EmbeddingJobData>): Promise<void> {
    const { documentId, storagePath, fileType, chunkingStrategy, chunkSize, chunkOverlap } =
      job.data;

    this.logger.log(`Processing document ${documentId}`);

    await this.prisma.document.update({
      where: { id: documentId },
      data: { status: "processing", processingStartedAt: new Date() },
    });

    try {
      // Download file from Supabase Storage
      const { data, error } = await this.supabase.storage.from("documents").download(storagePath);

      if (error || !data) {
        throw new Error(`Storage download failed: ${error?.message ?? "unknown"}`);
      }

      const rawText = await data.text();

      // Chunk the raw text (keep markdown for display in citations)
      const strategy = createChunkingStrategy({
        strategy: chunkingStrategy,
        chunkSize,
        chunkOverlap,
      });
      const chunks = strategy.chunk(rawText);

      if (chunks.length === 0) {
        throw new Error("Document produced zero chunks");
      }

      // Delete stale chunks (re-embedding scenario)
      await this.prisma.$executeRawUnsafe(
        `DELETE FROM chunks WHERE document_id = $1::uuid`,
        documentId,
      );

      // Embed and insert chunks in batches of EMBEDDING_BATCH_SIZE
      const BATCH_SIZE = 32;
      const textsToEmbed = chunks.map((chunk) =>
        fileType === "md" ? stripMarkdown(chunk.content) : chunk.content,
      );

      for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batchChunks = chunks.slice(i, i + BATCH_SIZE);
        const batchTexts = textsToEmbed.slice(i, i + BATCH_SIZE);
        const embeddings = await this.embeddingService.embedBatch(batchTexts);

        for (let j = 0; j < batchChunks.length; j++) {
          const chunk = batchChunks[j]!;
          const embStr = `[${embeddings[j]!.map((n) => n.toFixed(8)).join(",")}]`;

          await this.prisma.$executeRawUnsafe(
            `INSERT INTO chunks (id, document_id, content, embedding, chunk_index)
             VALUES (gen_random_uuid(), $1::uuid, $2, $3::vector, $4)`,
            documentId,
            chunk.content,
            embStr,
            chunk.index,
          );
        }
      }

      await this.prisma.document.update({
        where: { id: documentId },
        data: {
          status: "done",
          totalChunks: chunks.length,
          processingCompletedAt: new Date(),
          errorMessage: null,
        },
      });

      this.logger.log(`Document ${documentId} done — ${chunks.length} chunks`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Document ${documentId} failed: ${message}`);

      await this.prisma.document.update({
        where: { id: documentId },
        data: { status: "failed", errorMessage: message },
      });

      throw err; // BullMQ will retry based on job config
    }
  }
}
