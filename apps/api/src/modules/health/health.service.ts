import { Injectable, OnApplicationBootstrap, OnModuleDestroy } from "@nestjs/common";
import { Queue, QueueEvents } from "bullmq";
import { prisma } from "@rag-local/db";
import { parseRedisUrl } from "@rag-local/core";

const HEALTH_QUEUE = "health-check";

@Injectable()
export class HealthService implements OnApplicationBootstrap, OnModuleDestroy {
  private queue!: Queue;
  private queueEvents!: QueueEvents;

  onApplicationBootstrap(): void {
    const connection = parseRedisUrl();
    this.queue = new Queue(HEALTH_QUEUE, { connection });
    this.queueEvents = new QueueEvents(HEALTH_QUEUE, { connection });
  }

  async onModuleDestroy(): Promise<void> {
    await this.queueEvents?.close();
    await this.queue?.close();
  }

  async checkQueue(): Promise<{ status: string }> {
    const job = await this.queue.add("ping", { t: Date.now() });
    await job.waitUntilFinished(this.queueEvents, 5000);
    return { status: "ok" };
  }

  async checkDb(): Promise<{ status: string }> {
    await prisma.$queryRaw`SELECT 1`;
    return { status: "ok" };
  }
}
