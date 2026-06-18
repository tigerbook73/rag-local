/**
 * @test-file   EmbeddingProcessor
 * @description unit tests for process() progress tracking: totalChunks/processedChunks DB updates across batches
 * @ai-generated
 * @reviewed-by (!HUMAN EDIT ONLY):
 */
import { Test } from "@nestjs/testing";
import { getQueueToken } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import { EmbeddingProcessor } from "./embedding.processor.js";
import { QUEUE_NAMES, type EmbeddingJobData } from "@rag-local/core";

// ── Mocks ────────────────────────────────────────────────────────────────────

// vi.mock factories are hoisted; use vi.hoisted() to ensure refs are available
const { mockDocumentUpdate, mockExecuteRawUnsafe, mockEmbedBatch, mockDownload } = vi.hoisted(
  () => ({
    mockDocumentUpdate: vi.fn().mockResolvedValue({}),
    mockExecuteRawUnsafe: vi.fn().mockResolvedValue(0),
    mockEmbedBatch: vi.fn(),
    mockDownload: vi.fn(),
  }),
);

vi.mock("@rag-local/db", () => ({
  PrismaClient: class {
    document = { update: mockDocumentUpdate };
    $executeRawUnsafe = mockExecuteRawUnsafe;
    $disconnect = vi.fn();
  },
}));

vi.mock("@rag-local/core", async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const actual = await importOriginal<typeof import("@rag-local/core")>();
  return {
    ...actual,
    EmbeddingService: class {
      init = vi.fn();
      embedBatch = mockEmbedBatch;
    },
  };
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn().mockReturnValue({
    storage: {
      from: vi.fn().mockReturnValue({ download: mockDownload }),
    },
  }),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeJob(overrides: Partial<EmbeddingJobData> = {}): Job<EmbeddingJobData> {
  return {
    data: {
      documentId: "doc-1",
      storagePath: "test.txt",
      fileType: "txt",
      chunkingStrategy: "fixed",
      chunkSize: 50,
      chunkOverlap: 0,
      ...overrides,
    },
  } as Job<EmbeddingJobData>;
}

/** Returns a string of exactly `n` characters. */
function makeText(n: number) {
  return "a".repeat(n);
}

async function buildProcessor() {
  const module = await Test.createTestingModule({
    providers: [
      EmbeddingProcessor,
      { provide: getQueueToken(QUEUE_NAMES.EMBEDDING), useValue: {} },
    ],
  }).compile();
  return module.get(EmbeddingProcessor);
}

// ── Tests ────────────────────────────────────────────────────────────────────

/**
 * @test-suite  EmbeddingProcessor — progress tracking (totalChunks + processedChunks)
 * @target      DB updates for totalChunks and processedChunks during processing
 * @strategy    unit, PrismaClient / EmbeddingService / SupabaseClient mocked
 * @cases
 *   - [PASS] sets totalChunks and processedChunks to 0 immediately after chunking
 *   - [PASS] updates processedChunks after each batch until all chunks are embedded
 *   - [PASS] handles a single batch where chunk count is less than BATCH_SIZE
 */
describe("EmbeddingProcessor — progress tracking (totalChunks + processedChunks)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Return a fake blob whose .text() yields the raw text
    mockDownload.mockResolvedValue({
      data: { text: () => makeText(160) }, // 160 chars → ceil(160/50) = 4 chunks at size=50, overlap=0
      error: null,
    });
    // Return a 1024-dim zero vector for each text
    mockEmbedBatch.mockImplementation((texts: string[]) =>
      Promise.resolve(texts.map(() => new Array<number>(1024).fill(0))),
    );
  });

  it("sets totalChunks and processedChunks to 0 immediately after chunking", async () => {
    // 160 chars / chunkSize=50 / overlap=0 → 4 chunks
    mockDownload.mockResolvedValueOnce({
      data: { text: () => makeText(160) },
      error: null,
    });
    const processor = await buildProcessor();
    await processor.process(makeJob());

    // First progress update: totalChunks=4, processedChunks=0
    expect(mockDocumentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ totalChunks: 4, processedChunks: 0 }),
      }),
    );
  });

  it("updates processedChunks after each batch until all chunks are embedded", async () => {
    // chunkSize=50, overlap=0, text=1600 chars → 32 chunks → 1 full batch (BATCH_SIZE=32) + 0 remainder
    mockDownload.mockResolvedValueOnce({
      data: { text: () => makeText(1600) },
      error: null,
    });
    const processor = await buildProcessor();
    await processor.process(makeJob());

    // Progress updates (excluding the initial totalChunks=32/processedChunks=0 update)
    const progressUpdates = mockDocumentUpdate.mock.calls.filter(
      ([arg]) => "processedChunks" in arg.data && arg.data.processedChunks > 0,
    );
    // 32 chunks / BATCH_SIZE(32) = 1 batch → 1 progress update with processedChunks=32
    expect(progressUpdates).toHaveLength(1);
    expect(progressUpdates[0]![0].data.processedChunks).toBe(32);
  });

  it("handles a single batch where chunk count is less than BATCH_SIZE", async () => {
    // chunkSize=50, overlap=0, text=100 chars → 2 chunks (well under BATCH_SIZE=32)
    mockDownload.mockResolvedValueOnce({
      data: { text: () => makeText(100) },
      error: null,
    });
    const processor = await buildProcessor();
    await processor.process(makeJob());

    const progressUpdates = mockDocumentUpdate.mock.calls.filter(
      ([arg]) => "processedChunks" in arg.data && arg.data.processedChunks > 0,
    );
    expect(progressUpdates).toHaveLength(1);
    expect(progressUpdates[0]![0].data.processedChunks).toBe(2);
  });
});
