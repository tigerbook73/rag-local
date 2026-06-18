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
  content: string;
  chunk_index: number;
  similarity_score: number;
}

export interface RetrievalOptions {
  topK: number;
  hyde: boolean;
  reranking: boolean;
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

    const embedText =
      options.hyde && llmProvider ? await this.generateHydeText(query, llmProvider) : query;
    const embedding = await this.embeddingService.embed(embedText);
    const rows = await this.vectorSearch(embedding, options.topK);

    let chunks: RetrievedChunk[] = rows.map((r) => ({
      chunkId: r.id,
      documentId: r.document_id,
      documentName: r.filename,
      content: r.content,
      similarityScore: Number(r.similarity_score),
    }));

    if (options.reranking && chunks.length > 0) {
      chunks = await this.rerank(query, chunks);
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
