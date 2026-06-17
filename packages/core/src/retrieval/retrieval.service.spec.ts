/**
 * @test-file   RetrievalService
 * @description unit tests for retrieve() with mocked EmbeddingService and PrismaLike
 * @ai-generated
 * @reviewed-by (!HUMAN EDIT ONLY):
 */
import { describe, it, expect, vi } from "vitest";
import { RetrievalService } from "./retrieval.service.js";
import type { EmbeddingService } from "../embedding/embedding.service.js";

const mockEmbeddingService: Pick<EmbeddingService, "embed"> = {
  embed: vi.fn(),
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

/**
 * @test-suite  RetrievalService — retrieve()
 * @target      vector similarity search returning mapped RetrievedChunk[]
 * @strategy    unit, EmbeddingService and PrismaLike mocked
 * @cases
 *   - [PASS] calls embeddingService.embed with the original query
 *   - [PASS] maps ChunkRow fields to RetrievedChunk correctly
 *   - [PASS] returns non-negative retrievalMs
 *   - [PASS] passes topK to the raw SQL query
 */
describe("RetrievalService — retrieve()", () => {
  it("calls embeddingService.embed with the original query", async () => {
    vi.mocked(mockEmbeddingService.embed).mockResolvedValue(FAKE_EMBEDDING);
    mockPrisma.$queryRawUnsafe.mockResolvedValue([]);

    const service = new RetrievalService(
      mockEmbeddingService as unknown as EmbeddingService,
      mockPrisma,
    );
    await service.retrieve("reset password", { topK: 5 });

    expect(mockEmbeddingService.embed).toHaveBeenCalledWith("reset password");
  });

  it("maps ChunkRow fields to RetrievedChunk correctly", async () => {
    vi.mocked(mockEmbeddingService.embed).mockResolvedValue(FAKE_EMBEDDING);
    mockPrisma.$queryRawUnsafe.mockResolvedValue(FAKE_ROWS);

    const service = new RetrievalService(
      mockEmbeddingService as unknown as EmbeddingService,
      mockPrisma,
    );
    const { chunks } = await service.retrieve("query", { topK: 5 });

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
    const { retrievalMs } = await service.retrieve("query", { topK: 3 });

    expect(retrievalMs).toBeGreaterThanOrEqual(0);
  });

  it("passes topK to the raw SQL query", async () => {
    vi.mocked(mockEmbeddingService.embed).mockResolvedValue(FAKE_EMBEDDING);
    mockPrisma.$queryRawUnsafe.mockResolvedValue([]);

    const service = new RetrievalService(
      mockEmbeddingService as unknown as EmbeddingService,
      mockPrisma,
    );
    await service.retrieve("query", { topK: 7 });

    expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      7,
    );
  });
});
