import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { MessagesController } from "./messages.controller.js";
import { MessagesService } from "./messages.service.js";
import { MessagesBootstrapService } from "./messages-bootstrap.service.js";
import { SettingsModule } from "../settings/settings.module.js";
import { PrismaService } from "../../common/prisma.service.js";
import { EmbeddingService, LLMService, RetrievalService, QUEUE_NAMES } from "@rag-local/core";

@Module({
  imports: [SettingsModule, BullModule.registerQueue({ name: QUEUE_NAMES.EVALUATION })],
  controllers: [MessagesController],
  providers: [
    MessagesService,
    MessagesBootstrapService,
    EmbeddingService,
    LLMService,
    {
      provide: RetrievalService,
      useFactory: (embedding: EmbeddingService, prisma: PrismaService): RetrievalService =>
        new RetrievalService(embedding, prisma),
      inject: [EmbeddingService, PrismaService],
    },
  ],
  exports: [MessagesService],
})
export class MessagesModule {}
