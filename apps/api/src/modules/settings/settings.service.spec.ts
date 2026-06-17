/**
 * @test-file   SettingsService
 * @description unit tests for getSettings() and updateSettings() with mocked PrismaService
 * @ai-generated
 * @reviewed-by (!HUMAN EDIT ONLY):
 */
import { Test } from "@nestjs/testing";
import { SettingsService } from "./settings.service.js";
import { PrismaService } from "../../common/prisma.service.js";
import { SETTINGS_KEYS, SETTINGS_DEFAULTS } from "./settings.constants.js";

const mockPrisma = {
  setting: {
    findMany: vi.fn(),
    upsert: vi.fn(),
  },
};

async function buildService() {
  const module = await Test.createTestingModule({
    providers: [SettingsService, { provide: PrismaService, useValue: mockPrisma }],
  }).compile();
  return module.get(SettingsService);
}

/**
 * @test-suite  SettingsService — getSettings()
 * @target      assembles AppSettings from DB rows, falling back to SETTINGS_DEFAULTS
 * @strategy    unit, PrismaService mocked
 * @cases
 *   - [PASS] returns all default values when DB has no rows
 *   - [PASS] DB rows override default values
 *   - [PASS] derives deepseek model and baseUrl from PROVIDER_CONFIG
 *   - [PASS] derives openai model and null baseUrl from PROVIDER_CONFIG
 *   - [PASS] parses integer settings from string DB values
 *   - [PASS] parses boolean settings from string DB values
 */
describe("SettingsService — getSettings()", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns all default values when DB has no rows", async () => {
    mockPrisma.setting.findMany.mockResolvedValue([]);
    const service = await buildService();
    const settings = await service.getSettings();

    expect(settings.llmProvider).toBe("deepseek");
    expect(settings.chunkingStrategy).toBe("fixed");
    expect(settings.chunkSize).toBe(512);
    expect(settings.chunkOverlap).toBe(50);
    expect(settings.hydeEnabled).toBe(false);
    expect(settings.rerankingEnabled).toBe(false);
    expect(settings.topK).toBe(5);
    expect(settings.onlineEvaluationEnabled).toBe(false);
    expect(settings.conversationHistoryWindow).toBe(50);
  });

  it("DB rows override default values", async () => {
    mockPrisma.setting.findMany.mockResolvedValue([
      { key: SETTINGS_KEYS.TOP_K, value: "10" },
      { key: SETTINGS_KEYS.CHUNK_SIZE, value: "1024" },
    ]);
    const service = await buildService();
    const settings = await service.getSettings();

    expect(settings.topK).toBe(10);
    expect(settings.chunkSize).toBe(1024);
  });

  it("derives deepseek model and baseUrl from PROVIDER_CONFIG", async () => {
    mockPrisma.setting.findMany.mockResolvedValue([
      { key: SETTINGS_KEYS.LLM_PROVIDER, value: "deepseek" },
    ]);
    const service = await buildService();
    const settings = await service.getSettings();

    expect(settings.llmModel).toBe("deepseek-chat");
    expect(settings.llmBaseUrl).toBe("https://api.deepseek.com");
  });

  it("derives openai model and null baseUrl from PROVIDER_CONFIG", async () => {
    mockPrisma.setting.findMany.mockResolvedValue([
      { key: SETTINGS_KEYS.LLM_PROVIDER, value: "openai" },
    ]);
    const service = await buildService();
    const settings = await service.getSettings();

    expect(settings.llmModel).toBe("gpt-4o");
    expect(settings.llmBaseUrl).toBeNull();
  });

  it("parses integer settings from string DB values", async () => {
    mockPrisma.setting.findMany.mockResolvedValue([
      { key: SETTINGS_KEYS.CHUNK_OVERLAP, value: "128" },
      { key: SETTINGS_KEYS.CONVERSATION_HISTORY_WINDOW, value: "20" },
    ]);
    const service = await buildService();
    const settings = await service.getSettings();

    expect(typeof settings.chunkOverlap).toBe("number");
    expect(settings.chunkOverlap).toBe(128);
    expect(settings.conversationHistoryWindow).toBe(20);
  });

  it("parses boolean settings from string DB values", async () => {
    mockPrisma.setting.findMany.mockResolvedValue([
      { key: SETTINGS_KEYS.HYDE_ENABLED, value: "true" },
      { key: SETTINGS_KEYS.RERANKING_ENABLED, value: "false" },
    ]);
    const service = await buildService();
    const settings = await service.getSettings();

    expect(settings.hydeEnabled).toBe(true);
    expect(settings.rerankingEnabled).toBe(false);
  });
});

/**
 * @test-suite  SettingsService — updateSettings()
 * @target      upserts changed fields and detects requiresReindex
 * @strategy    unit, PrismaService mocked
 * @cases
 *   - [PASS] returns requiresReindex: true when chunkSize is changed
 *   - [PASS] returns requiresReindex: true when chunkingStrategy is changed
 *   - [PASS] does not return requiresReindex when only topK is changed
 *   - [PASS] does not return requiresReindex when chunk settings are unchanged
 *   - [PASS] only upserts fields present in the DTO
 */
describe("SettingsService — updateSettings()", () => {
  beforeEach(() => vi.clearAllMocks());

  function setupGetSettings(overrides: Record<string, string> = {}) {
    const defaults = { ...SETTINGS_DEFAULTS, ...overrides };
    mockPrisma.setting.findMany.mockResolvedValue(
      Object.entries(defaults).map(([key, value]) => ({ key, value })),
    );
    mockPrisma.setting.upsert.mockResolvedValue({});
  }

  it("returns requiresReindex: true when chunkSize is changed", async () => {
    setupGetSettings({ [SETTINGS_KEYS.CHUNK_SIZE]: "512" });
    const service = await buildService();

    // After update, getSettings will return new chunkSize
    mockPrisma.setting.findMany
      .mockResolvedValueOnce(
        Object.entries({ ...SETTINGS_DEFAULTS }).map(([key, value]) => ({ key, value })),
      )
      .mockResolvedValue(
        Object.entries({ ...SETTINGS_DEFAULTS, [SETTINGS_KEYS.CHUNK_SIZE]: "1024" }).map(
          ([key, value]) => ({ key, value }),
        ),
      );

    const result = await service.updateSettings({ chunkSize: 1024 });
    expect(result.requiresReindex).toBe(true);
  });

  it("returns requiresReindex: true when chunkingStrategy is changed", async () => {
    mockPrisma.setting.findMany
      .mockResolvedValueOnce(
        Object.entries(SETTINGS_DEFAULTS).map(([key, value]) => ({ key, value })),
      )
      .mockResolvedValue(
        Object.entries({ ...SETTINGS_DEFAULTS, [SETTINGS_KEYS.CHUNKING_STRATEGY]: "semantic" }).map(
          ([key, value]) => ({ key, value }),
        ),
      );
    mockPrisma.setting.upsert.mockResolvedValue({});

    const service = await buildService();
    const result = await service.updateSettings({ chunkingStrategy: "semantic" });
    expect(result.requiresReindex).toBe(true);
  });

  it("does not return requiresReindex when only topK is changed", async () => {
    const defaults = Object.entries(SETTINGS_DEFAULTS).map(([key, value]) => ({ key, value }));
    mockPrisma.setting.findMany.mockResolvedValue(defaults);
    mockPrisma.setting.upsert.mockResolvedValue({});

    const service = await buildService();
    const result = await service.updateSettings({ topK: 10 });
    expect(result.requiresReindex).toBeUndefined();
  });

  it("does not return requiresReindex when chunk settings are unchanged", async () => {
    // Before and after have same chunk settings
    const defaults = Object.entries(SETTINGS_DEFAULTS).map(([key, value]) => ({ key, value }));
    mockPrisma.setting.findMany.mockResolvedValueOnce(defaults).mockResolvedValue(defaults);
    mockPrisma.setting.upsert.mockResolvedValue({});

    const service = await buildService();
    // Sending the same chunkSize as existing default
    const result = await service.updateSettings({ chunkSize: 512 });
    expect(result.requiresReindex).toBeUndefined();
  });

  it("only upserts fields present in the DTO", async () => {
    const defaults = Object.entries(SETTINGS_DEFAULTS).map(([key, value]) => ({ key, value }));
    mockPrisma.setting.findMany.mockResolvedValue(defaults);
    mockPrisma.setting.upsert.mockResolvedValue({});

    const service = await buildService();
    await service.updateSettings({ topK: 8 });

    expect(mockPrisma.setting.upsert).toHaveBeenCalledTimes(1);
    expect(mockPrisma.setting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { key: SETTINGS_KEYS.TOP_K } }),
    );
  });
});
