import { Injectable, OnApplicationBootstrap } from "@nestjs/common";
import { EmbeddingService, LLMService } from "@rag-local/core";
import { SettingsService } from "../settings/settings.service.js";

@Injectable()
export class MessagesBootstrapService implements OnApplicationBootstrap {
  constructor(
    private readonly embedding: EmbeddingService,
    private readonly llm: LLMService,
    private readonly settings: SettingsService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.embedding.init();

    const { llmProvider, llmModel, llmBaseUrl } = await this.settings.getSettings();
    this.llm.init({
      provider: llmProvider,
      model: llmModel,
      baseUrl: llmBaseUrl ?? undefined,
      apiKey: process.env["LLM_API_KEY"]!,
    });
  }
}
