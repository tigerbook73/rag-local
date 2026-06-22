import type { EmbeddingService } from "../embedding/embedding.service.js";
import type { LLMProvider } from "../llm/llm.service.js";
import type { RetrievedChunk } from "../types/retrieval.js";

interface PrismaLike {
  $queryRawUnsafe<T>(query: string, ...args: unknown[]): Promise<T>;
}

interface ChunkRow {
  id: string;
  document_id: string;
  filename: string;
  file_type: string;
  content: string;
  chunk_index: number;
  similarity_score: number;
  metadata: Record<string, unknown> | null;
}

export interface RetrievalOptions {
  topK: number;
  hyde: boolean;
  reranking: boolean;
  /** Number of chunks to keep after reranking. Only applies when reranking is enabled. */
  rerankTopK?: number;
  retrievalMode?: "dense" | "bm25" | "hybrid";
  rrfK?: number;
  /** Minimum similarity score threshold (0–1). Applied to dense and bm25 modes only; hybrid RRF scores are not comparable percentages. */
  minSimilarityScore?: number;
}

export interface RetrievalResult {
  chunks: RetrievedChunk[];
  retrievalMs: number;
}

const HYDE_PROMPT = `Generate a concise hypothetical document that would directly answer the following question. Write only the answer text, no preamble.

Question: `;

export class RetrievalService {
  constructor(
    private readonly embeddingService: EmbeddingService,
    private readonly prisma: PrismaLike,
  ) {}

  async retrieve(
    query: string,
    options: RetrievalOptions,
    llmProvider?: LLMProvider,
  ): Promise<RetrievalResult> {
    const start = Date.now();
    const mode = options.retrievalMode ?? "dense";
    let chunks: RetrievedChunk[];

    if (mode === "bm25") {
      const rows = await this.bm25Search(query, options.topK);
      chunks = rows.map((r) => ({
        chunkId: r.id,
        documentId: r.document_id,
        documentName: r.filename,
        fileType: r.file_type,
        content: r.content,
        similarityScore: Number(r.similarity_score),
        metadata: r.metadata,
      }));
    } else if (mode === "hybrid") {
      const embedText =
        options.hyde && llmProvider ? await this.generateHydeText(query, llmProvider) : query;
      const embedding = await this.embeddingService.embed(embedText);
      const candidate = options.topK * 2;
      const [denseRows, bm25Rows] = await Promise.all([
        this.vectorSearch(embedding, candidate),
        this.bm25Search(query, candidate),
      ]);
      const denseChunks = denseRows.map((r) => this.rowToChunk(r));
      const bm25Chunks = bm25Rows.map((r) => this.rowToChunk(r));
      chunks = this.fuseRRF(denseChunks, bm25Chunks, options.rrfK ?? 60).slice(0, options.topK);
    } else {
      // dense (default)
      const embedText =
        options.hyde && llmProvider ? await this.generateHydeText(query, llmProvider) : query;
      const embedding = await this.embeddingService.embed(embedText);
      const rows = await this.vectorSearch(embedding, options.topK);
      chunks = rows.map((r) => this.rowToChunk(r));
    }

    if (options.reranking && chunks.length > 0) {
      chunks = await this.rerank(query, chunks);
      if (options.rerankTopK != null) {
        chunks = chunks.slice(0, options.rerankTopK);
      }
    }

    // Filter by similarity threshold for dense/bm25 modes (hybrid RRF scores are not percentage-based)
    if (mode !== "hybrid" && options.minSimilarityScore != null) {
      chunks = chunks.filter((c) => c.similarityScore > options.minSimilarityScore!);
    }

    const retrievalMs = Date.now() - start;
    return { chunks, retrievalMs };
  }

  private async generateHydeText(query: string, llmProvider: LLMProvider): Promise<string> {
    try {
      return await llmProvider.chat([{ role: "user", content: `${HYDE_PROMPT}${query}` }]);
    } catch {
      // Fall back to original query if LLM call fails
      return query;
    }
  }

  private async rerank(query: string, chunks: RetrievedChunk[]): Promise<RetrievedChunk[]> {
    try {
      const passages = chunks.map((c) => c.content);
      const scores = await this.embeddingService.rerank(query, passages);
      return chunks
        .map((chunk, i) => ({ ...chunk, rerankScore: scores[i] }))
        .sort((a, b) => (b.rerankScore ?? 0) - (a.rerankScore ?? 0));
    } catch {
      // Fall back to original order if reranking fails
      return chunks;
    }
  }

  private rowToChunk(r: ChunkRow): RetrievedChunk {
    return {
      chunkId: r.id,
      documentId: r.document_id,
      documentName: r.filename,
      fileType: r.file_type,
      content: r.content,
      similarityScore: Number(r.similarity_score),
      metadata: r.metadata,
    };
  }

  private fuseRRF(
    denseChunks: RetrievedChunk[],
    bm25Chunks: RetrievedChunk[],
    k: number,
  ): RetrievedChunk[] {
    const scores = new Map<string, number>();
    const byId = new Map<string, RetrievedChunk>();

    for (let rank = 0; rank < denseChunks.length; rank++) {
      const c = denseChunks[rank]!;
      scores.set(c.chunkId, (scores.get(c.chunkId) ?? 0) + 1 / (k + rank + 1));
      byId.set(c.chunkId, c);
    }
    for (let rank = 0; rank < bm25Chunks.length; rank++) {
      const c = bm25Chunks[rank]!;
      scores.set(c.chunkId, (scores.get(c.chunkId) ?? 0) + 1 / (k + rank + 1));
      byId.set(c.chunkId, c);
    }

    return [...scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id, score]) => ({ ...byId.get(id)!, similarityScore: score }));
  }

  private async bm25Search(query: string, topK: number): Promise<ChunkRow[]> {
    // plainto_tsquery handles arbitrary text safely; $1 is referenced twice but passed once.
    return this.prisma.$queryRawUnsafe<ChunkRow[]>(
      `SELECT c.id, c.document_id, d.filename, d.file_type, c.content, c.chunk_index,
              c.metadata, ts_rank_cd(c.fts, plainto_tsquery('english', $1))::float AS similarity_score
       FROM chunks c
       JOIN documents d ON d.id = c.document_id
       WHERE d.status = 'done'
         AND c.fts @@ plainto_tsquery('english', $1)
       ORDER BY similarity_score DESC
       LIMIT $2`,
      query,
      topK,
    );
  }

  private async vectorSearch(embedding: number[], topK: number): Promise<ChunkRow[]> {
    const embStr = `[${embedding.map((n) => n.toFixed(8)).join(",")}]`;
    return this.prisma.$queryRawUnsafe<ChunkRow[]>(
      `SELECT c.id, c.document_id, d.filename, d.file_type, c.content, c.chunk_index,
              c.metadata, (1 - (c.embedding <=> $1::vector)) AS similarity_score
       FROM chunks c
       JOIN documents d ON d.id = c.document_id
       WHERE d.status = 'done'
       ORDER BY c.embedding <=> $1::vector
       LIMIT $2`,
      embStr,
      topK,
    );
  }
}
