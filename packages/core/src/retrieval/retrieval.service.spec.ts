/**
 * @test-file   RetrievalService
 * @description unit tests for retrieve() covering basic vector search, HyDE, and re-ranking paths
 * @ai-generated
 * @reviewed-by (!HUMAN EDIT ONLY):
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RetrievalService } from "./retrieval.service.js";
import type { EmbeddingService } from "../embedding/embedding.service.js";
import type { LLMService } from "../llm/llm.service.js";

const mockEmbeddingService: Pick<EmbeddingService, "embed" | "rerank"> = {
  embed: vi.fn(),
  rerank: vi.fn(),
};

const mockLLMService: Pick<LLMService, "chat"> = {
  chat: vi.fn(),
};

const mockPrisma = {
  $queryRawUnsafe: vi.fn(),
};

const FAKE_EMBEDDING = [0.1, 0.2, 0.3];

const FAKE_ROWS = [
  {
    id: "chunk-1",
    document_id: "doc-1",
    filename: "faq.md",
    content: "How to reset password",
    chunk_index: 0,
    similarity_score: 0.92,
  },
  {
    id: "chunk-2",
    document_id: "doc-1",
    filename: "faq.md",
    content: "Contact support team",
    chunk_index: 1,
    similarity_score: 0.85,
  },
];

const BASE_OPTIONS = { topK: 5, hyde: false, reranking: false };

/**
 * @test-suite  RetrievalService — retrieve() basic vector search
 * @target      vector similarity search returning mapped RetrievedChunk[]
 * @strategy    unit, EmbeddingService and PrismaLike mocked
 * @cases
 *   - [PASS] calls embeddingService.embed with the original query when hyde is false
 *   - [PASS] maps ChunkRow fields to RetrievedChunk correctly
 *   - [PASS] returns non-negative retrievalMs
 *   - [PASS] passes topK to the raw SQL query
 */
describe("RetrievalService — retrieve() basic vector search", () => {
  it("calls embeddingService.embed with the original query when hyde is false", async () => {
    vi.mocked(mockEmbeddingService.embed).mockResolvedValue(FAKE_EMBEDDING);
    mockPrisma.$queryRawUnsafe.mockResolvedValue([]);

    const service = new RetrievalService(
      mockEmbeddingService as unknown as EmbeddingService,
      mockPrisma,
    );
    await service.retrieve("reset password", BASE_OPTIONS);

    expect(mockEmbeddingService.embed).toHaveBeenCalledWith("reset password");
  });

  it("maps ChunkRow fields to RetrievedChunk correctly", async () => {
    vi.mocked(mockEmbeddingService.embed).mockResolvedValue(FAKE_EMBEDDING);
    mockPrisma.$queryRawUnsafe.mockResolvedValue(FAKE_ROWS);

    const service = new RetrievalService(
      mockEmbeddingService as unknown as EmbeddingService,
      mockPrisma,
    );
    const { chunks } = await service.retrieve("query", BASE_OPTIONS);

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toEqual({
      chunkId: "chunk-1",
      documentId: "doc-1",
      documentName: "faq.md",
      content: "How to reset password",
      similarityScore: 0.92,
    });
  });

  it("returns non-negative retrievalMs", async () => {
    vi.mocked(mockEmbeddingService.embed).mockResolvedValue(FAKE_EMBEDDING);
    mockPrisma.$queryRawUnsafe.mockResolvedValue([]);

    const service = new RetrievalService(
      mockEmbeddingService as unknown as EmbeddingService,
      mockPrisma,
    );
    const { retrievalMs } = await service.retrieve("query", BASE_OPTIONS);

    expect(retrievalMs).toBeGreaterThanOrEqual(0);
  });

  it("passes topK to the raw SQL query", async () => {
    vi.mocked(mockEmbeddingService.embed).mockResolvedValue(FAKE_EMBEDDING);
    mockPrisma.$queryRawUnsafe.mockResolvedValue([]);

    const service = new RetrievalService(
      mockEmbeddingService as unknown as EmbeddingService,
      mockPrisma,
    );
    await service.retrieve("query", { ...BASE_OPTIONS, topK: 7 });

    expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      7,
    );
  });
});

/**
 * @test-suite  RetrievalService — retrieve() HyDE path
 * @target      hypothetical document embedding when hyde is true
 * @strategy    unit, LLMService and EmbeddingService mocked
 * @cases
 *   - [PASS] calls llmService.chat to generate hypothetical answer when hyde is true
 *   - [PASS] embeds the hypothetical answer instead of the original query when hyde is true
 *   - [PASS] falls back to original query when llmService is not provided and hyde is true
 */
describe("RetrievalService — retrieve() HyDE path", () => {
  it("calls llmService.chat to generate hypothetical answer when hyde is true", async () => {
    vi.mocked(mockLLMService.chat).mockResolvedValue("Hypothetical answer about passwords");
    vi.mocked(mockEmbeddingService.embed).mockResolvedValue(FAKE_EMBEDDING);
    mockPrisma.$queryRawUnsafe.mockResolvedValue([]);

    const service = new RetrievalService(
      mockEmbeddingService as unknown as EmbeddingService,
      mockPrisma,
      mockLLMService as unknown as LLMService,
    );
    await service.retrieve("how to reset password?", { ...BASE_OPTIONS, hyde: true });

    expect(mockLLMService.chat).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          role: "user",
          content: expect.stringContaining("how to reset password?"),
        }),
      ]),
    );
  });

  it("embeds the hypothetical answer instead of the original query when hyde is true", async () => {
    vi.mocked(mockLLMService.chat).mockResolvedValue("Hypothetical answer about passwords");
    vi.mocked(mockEmbeddingService.embed).mockResolvedValue(FAKE_EMBEDDING);
    mockPrisma.$queryRawUnsafe.mockResolvedValue([]);

    const service = new RetrievalService(
      mockEmbeddingService as unknown as EmbeddingService,
      mockPrisma,
      mockLLMService as unknown as LLMService,
    );
    await service.retrieve("how to reset password?", { ...BASE_OPTIONS, hyde: true });

    expect(mockEmbeddingService.embed).toHaveBeenCalledWith("Hypothetical answer about passwords");
  });

  it("falls back to original query when llmService is not provided and hyde is true", async () => {
    vi.mocked(mockEmbeddingService.embed).mockResolvedValue(FAKE_EMBEDDING);
    mockPrisma.$queryRawUnsafe.mockResolvedValue([]);

    const service = new RetrievalService(
      mockEmbeddingService as unknown as EmbeddingService,
      mockPrisma,
    );
    await service.retrieve("how to reset password?", { ...BASE_OPTIONS, hyde: true });

    expect(mockEmbeddingService.embed).toHaveBeenCalledWith("how to reset password?");
  });
});

/**
 * @test-suite  RetrievalService — retrieve() reranking path
 * @target      cross-encoder reranking applied after vector search
 * @strategy    unit, EmbeddingService.rerank mocked
 * @cases
 *   - [PASS] calls embeddingService.rerank with original query and chunk contents when reranking is true
 *   - [PASS] sorts chunks by rerankScore descending when reranking is true
 *   - [PASS] attaches rerankScore to each chunk when reranking is true
 *   - [PASS] skips reranking and returns original order when reranking is false
 */
describe("RetrievalService — retrieve() reranking path", () => {
  beforeEach(() => vi.clearAllMocks());
  it("calls embeddingService.rerank with original query and chunk contents when reranking is true", async () => {
    vi.mocked(mockEmbeddingService.embed).mockResolvedValue(FAKE_EMBEDDING);
    vi.mocked(mockEmbeddingService.rerank).mockResolvedValue([0.7, 0.9]);
    mockPrisma.$queryRawUnsafe.mockResolvedValue(FAKE_ROWS);

    const service = new RetrievalService(
      mockEmbeddingService as unknown as EmbeddingService,
      mockPrisma,
    );
    await service.retrieve("reset password", { ...BASE_OPTIONS, reranking: true });

    expect(mockEmbeddingService.rerank).toHaveBeenCalledWith("reset password", [
      "How to reset password",
      "Contact support team",
    ]);
  });

  it("sorts chunks by rerankScore descending when reranking is true", async () => {
    vi.mocked(mockEmbeddingService.embed).mockResolvedValue(FAKE_EMBEDDING);
    // chunk-1 gets score 0.7, chunk-2 gets 0.9 → chunk-2 should be first after rerank
    vi.mocked(mockEmbeddingService.rerank).mockResolvedValue([0.7, 0.9]);
    mockPrisma.$queryRawUnsafe.mockResolvedValue(FAKE_ROWS);

    const service = new RetrievalService(
      mockEmbeddingService as unknown as EmbeddingService,
      mockPrisma,
    );
    const { chunks } = await service.retrieve("reset password", {
      ...BASE_OPTIONS,
      reranking: true,
    });

    expect(chunks[0]!.chunkId).toBe("chunk-2");
    expect(chunks[1]!.chunkId).toBe("chunk-1");
  });

  it("attaches rerankScore to each chunk when reranking is true", async () => {
    vi.mocked(mockEmbeddingService.embed).mockResolvedValue(FAKE_EMBEDDING);
    vi.mocked(mockEmbeddingService.rerank).mockResolvedValue([0.7, 0.9]);
    mockPrisma.$queryRawUnsafe.mockResolvedValue(FAKE_ROWS);

    const service = new RetrievalService(
      mockEmbeddingService as unknown as EmbeddingService,
      mockPrisma,
    );
    const { chunks } = await service.retrieve("reset password", {
      ...BASE_OPTIONS,
      reranking: true,
    });

    expect(chunks.every((c) => c.rerankScore !== undefined)).toBe(true);
  });

  it("skips reranking and returns original order when reranking is false", async () => {
    vi.mocked(mockEmbeddingService.embed).mockResolvedValue(FAKE_EMBEDDING);
    mockPrisma.$queryRawUnsafe.mockResolvedValue(FAKE_ROWS);

    const service = new RetrievalService(
      mockEmbeddingService as unknown as EmbeddingService,
      mockPrisma,
    );
    const { chunks } = await service.retrieve("query", BASE_OPTIONS);

    expect(mockEmbeddingService.rerank).not.toHaveBeenCalled();
    expect(chunks[0]!.chunkId).toBe("chunk-1");
  });
});
