import type { EmbeddingService } from "../embedding/embedding.service.js";
import type { RetrievedChunk } from "../types/retrieval.js";

interface PrismaLike {
  $queryRawUnsafe<T>(query: string, ...args: unknown[]): Promise<T>;
}

interface ChunkRow {
  id: string;
  document_id: string;
  filename: string;
  content: string;
  chunk_index: number;
  similarity_score: number;
}

export interface RetrievalOptions {
  topK: number;
}

export interface RetrievalResult {
  chunks: RetrievedChunk[];
  retrievalMs: number;
}

export class RetrievalService {
  constructor(
    private readonly embeddingService: EmbeddingService,
    private readonly prisma: PrismaLike,
  ) {}

  async retrieve(query: string, options: RetrievalOptions): Promise<RetrievalResult> {
    const start = Date.now();
    const embedding = await this.embeddingService.embed(query);
    const rows = await this.vectorSearch(embedding, options.topK);
    const retrievalMs = Date.now() - start;

    const chunks: RetrievedChunk[] = rows.map((r) => ({
      chunkId: r.id,
      documentId: r.document_id,
      documentName: r.filename,
      content: r.content,
      similarityScore: Number(r.similarity_score),
    }));

    return { chunks, retrievalMs };
  }

  private async vectorSearch(embedding: number[], topK: number): Promise<ChunkRow[]> {
    const embStr = `[${embedding.map((n) => n.toFixed(8)).join(",")}]`;
    return this.prisma.$queryRawUnsafe<ChunkRow[]>(
      `SELECT c.id, c.document_id, d.filename, c.content, c.chunk_index,
              (1 - (c.embedding <=> $1::vector)) AS similarity_score
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
