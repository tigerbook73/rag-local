import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { LoggerModule } from "nestjs-pino";
import { EmbeddingProcessor } from "./processors/embedding.processor.js";
import { HealthProcessor } from "./processors/health.processor.js";
import { QUEUE_NAMES } from "@rag-local/core";

const { hostname: host, port: portStr } = new URL(
  process.env["REDIS_URL"] ?? "redis://localhost:6379",
);

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        transport: process.env["NODE_ENV"] !== "production" ? { target: "pino-pretty" } : undefined,
      },
    }),
    BullModule.forRoot({ connection: { host, port: Number(portStr || 6379) } }),
    BullModule.registerQueue({ name: QUEUE_NAMES.EMBEDDING }, { name: "health-check" }),
  ],
  providers: [EmbeddingProcessor, HealthProcessor],
})
export class AppModule {}
