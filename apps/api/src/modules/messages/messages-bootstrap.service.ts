import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { EmbeddingService } from "@rag-local/core";

@Injectable()
export class MessagesBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MessagesBootstrapService.name);

  constructor(private readonly embedding: EmbeddingService) {}

  onApplicationBootstrap(): void {
    this.embedding.init();
    this.logger.log(
      `Embedding sidecar configured: ${process.env["EMBEDDING_SERVICE_URL"] ?? "http://localhost:8000"}`,
    );
  }
}
