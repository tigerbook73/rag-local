/**
 * @test-file   MessagesService
 * @description unit tests for streamChat history injection, retrieval options, and findAll
 * @ai-generated
 * @reviewed-by (!HUMAN EDIT ONLY):
 */
import { NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { MessagesService } from "./messages.service.js";
import { PrismaService } from "../../common/prisma.service.js";
import { SettingsService } from "../settings/settings.service.js";
import { LLMService, RetrievalService } from "@rag-local/core";
import type { Response } from "express";

// ── mocks ─────────────────────────────────────────────────────────────────────

const mockPrisma = {
  conversation: { findUnique: vi.fn() },
  message: { create: vi.fn(), findMany: vi.fn() },
  promptTemplate: { findFirst: vi.fn() },
};

const mockSettingsService = { getSettings: vi.fn() };

const mockLlmProvider = { stream: vi.fn() };
const mockLlmService = { getProvider: vi.fn(() => mockLlmProvider) };

const mockRetrievalService = { retrieve: vi.fn() };

const DEFAULT_SETTINGS = {
  llmProvider: "deepseek",
  conversationHistoryWindow: 2,
  topK: 5,
  hydeEnabled: false,
  rerankingEnabled: false,
};

function makeRes(): Response {
  return { write: vi.fn(), end: vi.fn() } as unknown as Response;
}

async function buildService() {
  const module = await Test.createTestingModule({
    providers: [
      MessagesService,
      { provide: PrismaService, useValue: mockPrisma },
      { provide: SettingsService, useValue: mockSettingsService },
      { provide: LLMService, useValue: mockLlmService },
      { provide: RetrievalService, useValue: mockRetrievalService },
    ],
  }).compile();
  return module.get(MessagesService);
}

// ── helpers ───────────────────────────────────────────────────────────────────

function setupHappyPath(historyMessages: { role: string; content: string }[] = []) {
  mockPrisma.conversation.findUnique.mockResolvedValue({ id: "conv-1" });
  mockSettingsService.getSettings.mockResolvedValue(DEFAULT_SETTINGS);
  mockPrisma.message.findMany
    .mockResolvedValueOnce(historyMessages) // history fetch
    .mockResolvedValue([]); // any subsequent calls
  mockPrisma.message.create.mockResolvedValue({ id: "msg-new" });
  mockPrisma.promptTemplate.findFirst.mockResolvedValue(null);
  mockRetrievalService.retrieve.mockResolvedValue({ chunks: [], retrievalMs: 5 });
  mockLlmProvider.stream.mockImplementation(function* () {
    yield "Hello";
    yield " world";
  });
}

beforeEach(() => vi.clearAllMocks());

// ── findAll ───────────────────────────────────────────────────────────────────

/**
 * @test-suite  MessagesService.findAll
 * @target      returns messages wrapped in { data }
 * @strategy    unit, prisma mock
 * @cases
 *   - [PASS] returns messages in chronological order wrapped in { data }
 */
describe("MessagesService.findAll", () => {
  it("returns messages wrapped in { data }", async () => {
    const msgs = [{ id: "1" }, { id: "2" }];
    mockPrisma.message.findMany.mockResolvedValue(msgs);
    const svc = await buildService();
    const result = await svc.findAll("conv-1");
    expect(result).toEqual({ data: msgs });
    expect(mockPrisma.message.findMany).toHaveBeenCalledWith({
      where: { conversationId: "conv-1" },
      orderBy: { createdAt: "asc" },
    });
  });
});

// ── streamChat ────────────────────────────────────────────────────────────────

/**
 * @test-suite  MessagesService.streamChat
 * @target      conversation not found / history injection / SSE events / retrieval options
 * @strategy    unit, prisma + LLM mocks
 * @cases
 *   - [PASS] throws NotFoundException when conversation does not exist
 *   - [PASS] fetches history (window×2 messages) before saving user message
 *   - [PASS] injects fetched history between system prompt and current user turn
 *   - [PASS] emits delta and done SSE events
 *   - [PASS] does not inject history when conversationHistoryWindow is 0
 *   - [PASS] passes hyde and reranking flags from settings to retrieve()
 */
describe("MessagesService.streamChat", () => {
  it("throws NotFoundException when conversation does not exist", async () => {
    mockPrisma.conversation.findUnique.mockResolvedValue(null);
    const svc = await buildService();
    await expect(svc.streamChat("no-conv", { content: "hi" }, makeRes())).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("fetches history with window×2 messages before saving user message", async () => {
    setupHappyPath();
    const svc = await buildService();
    await svc.streamChat("conv-1", { content: "q" }, makeRes());

    expect(mockPrisma.message.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { conversationId: "conv-1" },
        orderBy: { createdAt: "desc" },
        take: DEFAULT_SETTINGS.conversationHistoryWindow * 2,
        select: { role: true, content: true },
      }),
    );
  });

  it("injects fetched history between system prompt and current user turn", async () => {
    // findMany returns DESC order (most recent first); service reverses to chronological
    const history = [
      { role: "assistant", content: "previous answer" },
      { role: "user", content: "previous question" },
    ];
    setupHappyPath(history);
    const svc = await buildService();
    await svc.streamChat("conv-1", { content: "follow-up" }, makeRes());

    const streamArgs = mockLlmProvider.stream.mock.calls[0]![0] as Array<{
      role: string;
      content: string;
    }>;
    expect(streamArgs[0]!.role).toBe("system");
    expect(streamArgs[1]).toEqual({ role: "user", content: "previous question" });
    expect(streamArgs[2]).toEqual({ role: "assistant", content: "previous answer" });
    expect(streamArgs[3]!.role).toBe("user");
    expect(streamArgs[3]!.content).toContain("follow-up");
  });

  it("emits delta and done SSE events", async () => {
    setupHappyPath();
    const res = makeRes();
    const svc = await buildService();
    await svc.streamChat("conv-1", { content: "q" }, res);

    const writes = (res.write as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0] as string);
    expect(writes.some((w) => w.startsWith("event: delta"))).toBe(true);
    expect(writes.some((w) => w.startsWith("event: done"))).toBe(true);
  });

  it("passes hyde and reranking flags from settings to retrieve()", async () => {
    mockPrisma.conversation.findUnique.mockResolvedValue({ id: "conv-1" });
    mockSettingsService.getSettings.mockResolvedValue({
      ...DEFAULT_SETTINGS,
      hydeEnabled: true,
      rerankingEnabled: true,
    });
    mockPrisma.message.findMany.mockResolvedValue([]);
    mockPrisma.message.create.mockResolvedValue({ id: "msg-new" });
    mockPrisma.promptTemplate.findFirst.mockResolvedValue(null);
    mockRetrievalService.retrieve.mockResolvedValue({ chunks: [], retrievalMs: 5 });
    mockLlmProvider.stream.mockImplementation(function* () {
      yield "ok";
    });

    const svc = await buildService();
    await svc.streamChat("conv-1", { content: "q" }, makeRes());

    expect(mockRetrievalService.retrieve).toHaveBeenCalledWith(
      "q",
      expect.objectContaining({ hyde: true, reranking: true }),
      expect.anything(),
    );
  });

  it("does not inject history when conversationHistoryWindow is 0", async () => {
    mockPrisma.conversation.findUnique.mockResolvedValue({ id: "conv-1" });
    mockSettingsService.getSettings.mockResolvedValue({
      ...DEFAULT_SETTINGS,
      conversationHistoryWindow: 0,
    });
    mockPrisma.message.create.mockResolvedValue({ id: "msg-new" });
    mockPrisma.promptTemplate.findFirst.mockResolvedValue(null);
    mockRetrievalService.retrieve.mockResolvedValue({ chunks: [], retrievalMs: 5 });
    mockLlmProvider.stream.mockImplementation(function* () {
      yield "ok";
    });

    const svc = await buildService();
    await svc.streamChat("conv-1", { content: "q" }, makeRes());

    // findMany should only be called for findAll-style calls, not history
    expect(mockPrisma.message.findMany).not.toHaveBeenCalled();
  });
});
