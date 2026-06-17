import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { EmbeddingService, LLMService } from "@rag-local/core";
import { getLlmApiKey } from "../../common/env.js";
import { SettingsService } from "../settings/settings.service.js";

@Injectable()
export class MessagesBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MessagesBootstrapService.name);

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
      apiKey: getLlmApiKey(llmProvider),
    });
  }
}
