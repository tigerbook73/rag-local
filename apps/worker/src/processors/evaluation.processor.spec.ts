/**
 * @test-file   EvaluationProcessor
 * @description unit tests for process(): calls EvaluationService and writes results to DB
 * @ai-generated
 * @reviewed-by (!HUMAN EDIT ONLY):
 */
import { Test } from "@nestjs/testing";
import { getQueueToken } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import { EvaluationProcessor } from "./evaluation.processor.js";
import { QUEUE_NAMES, type EvaluationJobData } from "@rag-local/core";

// ── mocks ─────────────────────────────────────────────────────────────────────

const { mockEvaluate, mockCreateMany } = vi.hoisted(() => ({
  mockEvaluate: vi.fn(),
  mockCreateMany: vi.fn().mockResolvedValue({}),
}));

vi.mock("@rag-local/db", () => ({
  PrismaClient: class {
    evaluation = { createMany: mockCreateMany };
    $disconnect = vi.fn();
  },
}));

vi.mock("@rag-local/core", async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const actual = await importOriginal<typeof import("@rag-local/core")>();
  return {
    ...actual,
    EvaluationService: class {
      evaluate = mockEvaluate;
    },
    LLMService: class {},
  };
});

// ── helpers ───────────────────────────────────────────────────────────────────

function makeJob(overrides: Partial<EvaluationJobData> = {}): Job<EvaluationJobData> {
  return {
    data: {
      messageId: "msg-1",
      question: "What is RAG?",
      answer: "Retrieval-Augmented Generation.",
      retrievedChunks: [],
      ...overrides,
    },
  } as Job<EvaluationJobData>;
}

async function buildProcessor() {
  const module = await Test.createTestingModule({
    providers: [
      EvaluationProcessor,
      { provide: getQueueToken(QUEUE_NAMES.EVALUATION), useValue: {} },
    ],
  }).compile();
  return module.get(EvaluationProcessor);
}

// ── tests ─────────────────────────────────────────────────────────────────────

/**
 * @test-suite  EvaluationProcessor.process
 * @target      delegates to EvaluationService and persists results
 * @strategy    unit, PrismaClient and EvaluationService mocked
 * @cases
 *   - [PASS] calls evaluate() with question, answer, and retrievedChunks from job
 *   - [PASS] writes all metric results to the evaluations table via createMany
 *   - [PASS] maps metric, score, and reason correctly to createMany data
 */
describe("EvaluationProcessor.process", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEvaluate.mockResolvedValue([
      { metric: "faithfulness", score: 0.9, reason: "on topic" },
      { metric: "answer_relevancy", score: 0.8, reason: "relevant" },
      { metric: "context_precision", score: 0.7, reason: "precise" },
    ]);
  });

  it("calls evaluate() with question, answer, and retrievedChunks from job data", async () => {
    const processor = await buildProcessor();
    const job = makeJob({ question: "Q?", answer: "A.", retrievedChunks: [] });
    await processor.process(job);

    expect(mockEvaluate).toHaveBeenCalledWith({
      question: "Q?",
      answer: "A.",
      retrievedChunks: [],
    });
  });

  it("writes all three metric results to evaluations table via createMany", async () => {
    const processor = await buildProcessor();
    await processor.process(makeJob());

    expect(mockCreateMany).toHaveBeenCalledOnce();
    const callArg = mockCreateMany.mock.calls[0]![0] as { data: unknown[] };
    expect(callArg.data).toHaveLength(3);
  });

  it("maps messageId, metric, score, and reason to createMany rows", async () => {
    const processor = await buildProcessor();
    await processor.process(makeJob({ messageId: "msg-42" }));

    const rows = (
      mockCreateMany.mock.calls[0]![0] as {
        data: Array<{ messageId: string; metric: string; score: number; reason: string }>;
      }
    ).data;
    expect(rows[0]).toMatchObject({
      messageId: "msg-42",
      metric: "faithfulness",
      score: 0.9,
      reason: "on topic",
    });
    expect(rows[1]).toMatchObject({ metric: "answer_relevancy", score: 0.8 });
    expect(rows[2]).toMatchObject({ metric: "context_precision", score: 0.7 });
  });
});
