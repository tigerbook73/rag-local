import { Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";

@Processor("embedding")
export class EmbeddingProcessor extends WorkerHost {
  private readonly logger = new Logger(EmbeddingProcessor.name);

  process(job: Job): Promise<void> {
    this.logger.log(`received job ${job.name} (${job.id}) — not yet implemented`);
    return Promise.resolve();
  }
}
