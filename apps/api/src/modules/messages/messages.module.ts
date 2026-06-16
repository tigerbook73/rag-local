import { Module } from "@nestjs/common";
import { MessagesController } from "./messages.controller.js";
import { MessagesService } from "./messages.service.js";
import { SettingsModule } from "../settings/settings.module.js";
import { SettingsService } from "../settings/settings.service.js";
import { PrismaService } from "../../common/prisma.service.js";
import { EmbeddingService, LLMService, RetrievalService } from "@rag-local/core";

@Module({
  imports: [SettingsModule],
  controllers: [MessagesController],
  providers: [
    MessagesService,
    {
      provide: EmbeddingService,
      useFactory: async (): Promise<EmbeddingService> => {
        const svc = new EmbeddingService();
        await svc.init();
        return svc;
      },
    },
    {
      provide: LLMService,
      useFactory: async (settingsSvc: SettingsService): Promise<LLMService> => {
        const settings = await settingsSvc.getSettings();
        const svc = new LLMService();
        svc.init({
          provider: settings.llmProvider,
          model: settings.llmModel,
          baseUrl: settings.llmBaseUrl ?? undefined,
          apiKey: process.env["LLM_API_KEY"]!,
        });
        return svc;
      },
      inject: [SettingsService],
    },
    {
      provide: RetrievalService,
      useFactory: (embedding: EmbeddingService, prisma: PrismaService): RetrievalService => {
        return new RetrievalService(embedding, prisma);
      },
      inject: [EmbeddingService, PrismaService],
    },
  ],
  exports: [MessagesService],
})
export class MessagesModule {}
