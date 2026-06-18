import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service.js";
import type { UpdateSettingsDto } from "./dto/update-settings.dto.js";
import { SETTINGS_KEYS, SETTINGS_DEFAULTS } from "./settings.constants.js";

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

const STATIC_KEYS = [
  SETTINGS_KEYS.CHUNKING_STRATEGY,
  SETTINGS_KEYS.CHUNK_SIZE,
  SETTINGS_KEYS.CHUNK_OVERLAP,
] as const;

function toBoolean(v: string): boolean {
  return v === "true";
}

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getSettings(): Promise<AppSettings> {
    const rows = await this.prisma.setting.findMany();
    const kv: Record<string, string> = { ...SETTINGS_DEFAULTS };
    for (const row of rows) kv[row.key] = row.value;

    const llmProvider = kv[SETTINGS_KEYS.LLM_PROVIDER] as "openai" | "deepseek";
    const { model: llmModel, baseUrl: llmBaseUrl } = PROVIDER_CONFIG[llmProvider];

    return {
      llmProvider,
      llmModel,
      llmBaseUrl,
      chunkingStrategy: kv[SETTINGS_KEYS.CHUNKING_STRATEGY] as "fixed" | "semantic",
      chunkSize: parseInt(kv[SETTINGS_KEYS.CHUNK_SIZE]!),
      chunkOverlap: parseInt(kv[SETTINGS_KEYS.CHUNK_OVERLAP]!),
      hydeEnabled: toBoolean(kv[SETTINGS_KEYS.HYDE_ENABLED]!),
      rerankingEnabled: toBoolean(kv[SETTINGS_KEYS.RERANKING_ENABLED]!),
      topK: parseInt(kv[SETTINGS_KEYS.TOP_K]!),
      onlineEvaluationEnabled: toBoolean(kv[SETTINGS_KEYS.ONLINE_EVALUATION_ENABLED]!),
      conversationHistoryWindow: parseInt(kv[SETTINGS_KEYS.CONVERSATION_HISTORY_WINDOW]!),
    };
  }

  async updateSettings(dto: UpdateSettingsDto): Promise<AppSettings & { requiresReindex?: true }> {
    const before = await this.getSettings();

    const dtoToKey: Partial<Record<keyof UpdateSettingsDto, string>> = {
      llmProvider: SETTINGS_KEYS.LLM_PROVIDER,
      chunkingStrategy: SETTINGS_KEYS.CHUNKING_STRATEGY,
      chunkSize: SETTINGS_KEYS.CHUNK_SIZE,
      chunkOverlap: SETTINGS_KEYS.CHUNK_OVERLAP,
      hydeEnabled: SETTINGS_KEYS.HYDE_ENABLED,
      rerankingEnabled: SETTINGS_KEYS.RERANKING_ENABLED,
      topK: SETTINGS_KEYS.TOP_K,
      onlineEvaluationEnabled: SETTINGS_KEYS.ONLINE_EVALUATION_ENABLED,
      conversationHistoryWindow: SETTINGS_KEYS.CONVERSATION_HISTORY_WINDOW,
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

    const changedKeys = Object.entries(dtoToKey)
      .filter(([dtoField]) => dto[dtoField as keyof UpdateSettingsDto] !== undefined)
      .map(([, key]) => key);
    this.logger.log(
      `Settings updated: [${changedKeys.join(", ")}]${requiresReindex ? " — reindex required" : ""}`,
    );

    return requiresReindex ? { ...after, requiresReindex: true } : after;
  }
}
