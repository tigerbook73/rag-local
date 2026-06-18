import { Module } from "@nestjs/common";
import { MessagesController } from "./messages.controller.js";
import { MessagesService } from "./messages.service.js";
import { MessagesBootstrapService } from "./messages-bootstrap.service.js";
import { SettingsModule } from "../settings/settings.module.js";
import { PrismaService } from "../../common/prisma.service.js";
import { EmbeddingService, LLMService, RetrievalService } from "@rag-local/core";

@Module({
  imports: [SettingsModule],
  controllers: [MessagesController],
  providers: [
    MessagesService,
    MessagesBootstrapService,
    EmbeddingService,
    LLMService,
    {
      provide: RetrievalService,
      useFactory: (
        embedding: EmbeddingService,
        prisma: PrismaService,
        llm: LLMService,
      ): RetrievalService => new RetrievalService(embedding, prisma, llm),
      inject: [EmbeddingService, PrismaService, LLMService],
    },
  ],
  exports: [MessagesService],
})
export class MessagesModule {}
