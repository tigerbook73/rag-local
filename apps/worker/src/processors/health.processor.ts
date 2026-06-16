import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";

@Processor("health-check")
export class HealthProcessor extends WorkerHost {
  process(_job: Job): Promise<{ pong: true }> {
    return Promise.resolve({ pong: true });
  }
}
