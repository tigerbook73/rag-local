import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { LoggerModule } from "nestjs-pino";
import { QUEUE_NAMES, parseRedisUrl, getRedisKeyPrefix } from "@rag-local/core";
import { EmbeddingProcessor } from "./processors/embedding.processor.js";
import { HealthProcessor } from "./processors/health.processor.js";

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        transport: process.env["NODE_ENV"] !== "production" ? { target: "pino-pretty" } : undefined,
      },
    }),
    BullModule.forRoot({ connection: parseRedisUrl(), prefix: getRedisKeyPrefix() || undefined }),
    BullModule.registerQueue({ name: QUEUE_NAMES.EMBEDDING }, { name: "health-check" }),
  ],
  providers: [EmbeddingProcessor, HealthProcessor],
})
export class AppModule {}
