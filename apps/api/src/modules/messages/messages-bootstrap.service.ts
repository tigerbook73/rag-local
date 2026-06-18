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
    this.embedding.init();
    this.logger.log(
      `Embedding sidecar configured: ${process.env["EMBEDDING_SERVICE_URL"] ?? "http://localhost:8000"}`,
    );

    const { llmProvider, llmModel, llmBaseUrl } = await this.settings.getSettings();
    this.llm.init({
      provider: llmProvider,
      model: llmModel,
      baseUrl: llmBaseUrl ?? undefined,
      apiKey: getLlmApiKey(llmProvider),
    });
    this.logger.log(`LLM initialized: provider=${llmProvider} model=${llmModel}`);
  }
}
