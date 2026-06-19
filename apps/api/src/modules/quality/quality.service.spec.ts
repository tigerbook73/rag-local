/**
 * @test-file   QualityService
 * @description unit tests for listEvaluations, listBeirRuns, and getBeirRunDetail
 * @ai-generated
 * @reviewed-by (!HUMAN EDIT ONLY):
 */
import { NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { QualityService } from "./quality.service.js";
import { PrismaService } from "../../common/prisma.service.js";

// ── mocks ─────────────────────────────────────────────────────────────────────

const mockPrisma = {
  message: {
    findMany: vi.fn(),
    count: vi.fn(),
    findFirst: vi.fn(),
  },
  beirEvalRun: {
    findMany: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
  },
};

async function buildService() {
  const module = await Test.createTestingModule({
    providers: [QualityService, { provide: PrismaService, useValue: mockPrisma }],
  }).compile();
  return module.get(QualityService);
}

beforeEach(() => vi.clearAllMocks());

// ── listEvaluations ───────────────────────────────────────────────────────────

/**
 * @test-suite  QualityService.listEvaluations
 * @target      returns paginated evaluation summaries with question text
 * @strategy    unit, PrismaService mocked
 * @cases
 *   - [PASS] returns empty data and total=0 when no evaluations exist
 *   - [PASS] maps evaluation scores to numbers (from Decimal)
 *   - [PASS] attaches question from preceding user message
 *   - [PASS] filters by conversationId when provided
 */
describe("QualityService.listEvaluations", () => {
  it("returns empty data and total=0 when no evaluations exist", async () => {
    mockPrisma.message.findMany.mockResolvedValue([]);
    mockPrisma.message.count.mockResolvedValue(0);
    const svc = await buildService();
    const result = await svc.listEvaluations({});
    expect(result).toEqual({ data: [], total: 0 });
  });

  it("maps evaluation Decimal score to number", async () => {
    const now = new Date();
    mockPrisma.message.findMany.mockResolvedValue([
      {
        id: "msg-1",
        conversationId: "conv-1",
        createdAt: now,
        conversation: { title: "test" },
        evaluations: [
          {
            metric: "faithfulness",
            score: { toNumber: () => 0.9, toString: () => "0.9" },
            reason: "ok",
          },
        ],
      },
    ]);
    mockPrisma.message.count.mockResolvedValue(1);
    mockPrisma.message.findFirst.mockResolvedValue(null); // no preceding user message

    const svc = await buildService();
    const result = await svc.listEvaluations({});
    expect(typeof result.data[0]!.evaluations[0]!.score).toBe("number");
    expect(result.data[0]!.evaluations[0]!.score).toBe(0.9);
  });

  it("attaches question from preceding user message", async () => {
    const now = new Date();
    mockPrisma.message.findMany.mockResolvedValueOnce([
      {
        id: "msg-1",
        conversationId: "conv-1",
        createdAt: now,
        conversation: { title: "" },
        evaluations: [{ metric: "faithfulness", score: 0.8, reason: "ok" }],
      },
    ]);
    mockPrisma.message.count.mockResolvedValue(1);
    // findMany called again inside buildQuestionMap for finding assistant messages
    mockPrisma.message.findMany.mockResolvedValueOnce([
      { id: "msg-1", conversationId: "conv-1", createdAt: now },
    ]);
    mockPrisma.message.findFirst.mockResolvedValue({ content: "What is RAG?" });

    const svc = await buildService();
    const result = await svc.listEvaluations({});
    expect(result.data[0]!.question).toBe("What is RAG?");
  });

  it("filters by conversationId when provided", async () => {
    mockPrisma.message.findMany.mockResolvedValue([]);
    mockPrisma.message.count.mockResolvedValue(0);
    const svc = await buildService();
    await svc.listEvaluations({ conversationId: "conv-42" });

    expect(mockPrisma.message.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ conversationId: "conv-42" }),
      }),
    );
  });
});

// ── listBeirRuns ──────────────────────────────────────────────────────────────

/**
 * @test-suite  QualityService.listBeirRuns
 * @target      returns paginated BEIR run summaries
 * @strategy    unit, PrismaService mocked
 * @cases
 *   - [PASS] returns empty data and total=0 when no runs exist
 *   - [PASS] maps run fields to summary shape
 *   - [PASS] filters by dataset when provided
 */
describe("QualityService.listBeirRuns", () => {
  it("returns empty data and total=0 when no runs exist", async () => {
    mockPrisma.beirEvalRun.findMany.mockResolvedValue([]);
    mockPrisma.beirEvalRun.count.mockResolvedValue(0);
    const svc = await buildService();
    const result = await svc.listBeirRuns({});
    expect(result).toEqual({ data: [], total: 0 });
  });

  it("maps run fields to summary shape", async () => {
    const now = new Date();
    mockPrisma.beirEvalRun.findMany.mockResolvedValue([
      {
        id: "run-1",
        dataset: "scifact",
        embeddingConfig: "bge-m3-v1",
        sampleSize: 50,
        metrics: { ndcg10: 0.75, recall10: 0.6, recall100: 0.9, mrr10: 0.7 },
        details: [],
        createdAt: now,
      },
    ]);
    mockPrisma.beirEvalRun.count.mockResolvedValue(1);
    const svc = await buildService();
    const result = await svc.listBeirRuns({});
    expect(result.data[0]).toMatchObject({
      id: "run-1",
      dataset: "scifact",
      sampleSize: 50,
    });
  });

  it("filters by dataset when provided", async () => {
    mockPrisma.beirEvalRun.findMany.mockResolvedValue([]);
    mockPrisma.beirEvalRun.count.mockResolvedValue(0);
    const svc = await buildService();
    await svc.listBeirRuns({ dataset: "fiqa" });

    expect(mockPrisma.beirEvalRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { dataset: "fiqa" } }),
    );
  });
});

// ── getBeirRunDetail ──────────────────────────────────────────────────────────

/**
 * @test-suite  QualityService.getBeirRunDetail
 * @target      returns full run detail or throws NotFoundException
 * @strategy    unit, PrismaService mocked
 * @cases
 *   - [PASS] throws NotFoundException when run does not exist
 *   - [PASS] returns detail including metrics and details fields
 */
describe("QualityService.getBeirRunDetail", () => {
  it("throws NotFoundException when run does not exist", async () => {
    mockPrisma.beirEvalRun.findUnique.mockResolvedValue(null);
    const svc = await buildService();
    await expect(svc.getBeirRunDetail("nonexistent")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("returns detail including metrics and details fields", async () => {
    const now = new Date();
    const run = {
      id: "run-1",
      dataset: "scifact",
      embeddingConfig: "bge-m3-v1",
      sampleSize: 10,
      metrics: { ndcg10: 0.8, recall10: 0.7, recall100: 0.95, mrr10: 0.75 },
      queryDetails: [
        {
          id: "d-1",
          runId: "run-1",
          queryId: "q1",
          queryText: "text",
          hits: [],
          ndcg10: 0.8,
          relevantInTop10: 1,
        },
      ],
      createdAt: now,
    };
    mockPrisma.beirEvalRun.findUnique.mockResolvedValue(run);
    const svc = await buildService();
    const result = await svc.getBeirRunDetail("run-1");
    expect(result.metrics).toEqual(run.metrics);
    expect(result.details).toEqual([
      { queryId: "q1", queryText: "text", hits: [], ndcg10: 0.8, relevantInTop10: 1 },
    ]);
  });
});
