import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service.js";
import type { UpdateSettingsDto } from "./dto/update-settings.dto.js";

export interface AppSettings {
  llmProvider: "openai" | "deepseek";
  llmModel: string;
  llmBaseUrl: string | null;
  chunkingStrategy: "fixed" | "semantic";
  chunkSize: number;
  chunkOverlap: number;
  hydeEnabled: boolean;
  rerankingEnabled: boolean;
  topK: number;
  onlineEvaluationEnabled: boolean;
  conversationHistoryWindow: number;
}

const PROVIDER_CONFIG: Record<"openai" | "deepseek", { model: string; baseUrl: string | null }> = {
  deepseek: { model: "deepseek-chat", baseUrl: "https://api.deepseek.com" },
  openai: { model: "gpt-4o", baseUrl: null },
};

const DEFAULTS: Record<string, string> = {
  llm_provider: "deepseek",
  chunking_strategy: "fixed",
  chunk_size: "512",
  chunk_overlap: "50",
  hyde_enabled: "false",
  reranking_enabled: "false",
  top_k: "5",
  online_evaluation_enabled: "false",
  conversation_history_window: "50",
};

const STATIC_KEYS = ["chunking_strategy", "chunk_size", "chunk_overlap"] as const;

function toBoolean(v: string): boolean {
  return v === "true";
}

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(): Promise<AppSettings> {
    const rows = await this.prisma.setting.findMany();
    const kv: Record<string, string> = { ...DEFAULTS };
    for (const row of rows) kv[row.key] = row.value;

    const llmProvider = kv["llm_provider"] as "openai" | "deepseek";
    const { model: llmModel, baseUrl: llmBaseUrl } = PROVIDER_CONFIG[llmProvider];

    return {
      llmProvider,
      llmModel,
      llmBaseUrl,
      chunkingStrategy: kv["chunking_strategy"] as "fixed" | "semantic",
      chunkSize: parseInt(kv["chunk_size"]!),
      chunkOverlap: parseInt(kv["chunk_overlap"]!),
      hydeEnabled: toBoolean(kv["hyde_enabled"]!),
      rerankingEnabled: toBoolean(kv["reranking_enabled"]!),
      topK: parseInt(kv["top_k"]!),
      onlineEvaluationEnabled: toBoolean(kv["online_evaluation_enabled"]!),
      conversationHistoryWindow: parseInt(kv["conversation_history_window"]!),
    };
  }

  async updateSettings(dto: UpdateSettingsDto): Promise<AppSettings & { requiresReindex?: true }> {
    const before = await this.getSettings();

    const dtoToKey: Partial<Record<keyof UpdateSettingsDto, string>> = {
      llmProvider: "llm_provider",
      chunkingStrategy: "chunking_strategy",
      chunkSize: "chunk_size",
      chunkOverlap: "chunk_overlap",
      hydeEnabled: "hyde_enabled",
      rerankingEnabled: "reranking_enabled",
      topK: "top_k",
      onlineEvaluationEnabled: "online_evaluation_enabled",
      conversationHistoryWindow: "conversation_history_window",
    };

    const upserts = Object.entries(dtoToKey)
      .filter(([dtoField]) => dto[dtoField as keyof UpdateSettingsDto] !== undefined)
      .map(([dtoField, key]) => {
        const raw = dto[dtoField as keyof UpdateSettingsDto];
        const value = String(raw);
        return this.prisma.setting.upsert({
          where: { key },
          create: { key, value },
          update: { value },
        });
      });

    await Promise.all(upserts);

    const after = await this.getSettings();

    const requiresReindex =
      STATIC_KEYS.some((k) => {
        const dtoField = Object.entries(dtoToKey).find(([, dbKey]) => dbKey === k)?.[0];
        return dtoField && dto[dtoField as keyof UpdateSettingsDto] !== undefined;
      }) &&
      (before.chunkingStrategy !== after.chunkingStrategy ||
        before.chunkSize !== after.chunkSize ||
        before.chunkOverlap !== after.chunkOverlap);

    return requiresReindex ? { ...after, requiresReindex: true } : after;
  }
}
