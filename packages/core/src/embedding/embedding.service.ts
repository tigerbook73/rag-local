export class EmbeddingService {
  private baseUrl: string = "";

  /** Connect to the Python embedding sidecar. Call once at process startup. */
  init(): void {
    this.baseUrl = process.env["EMBEDDING_SERVICE_URL"] ?? "http://localhost:8000";
  }

  async embed(text: string): Promise<number[]> {
    if (!this.baseUrl) throw new Error("EmbeddingService not initialized — call init() first");
    const res = await fetch(`${this.baseUrl}/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error(`Embedding service error: ${res.status} ${res.statusText}`);
    const { embedding } = (await res.json()) as { embedding: number[] };
    return embedding;
  }

  /** Batch embedding — single HTTP call for all texts */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!this.baseUrl) throw new Error("EmbeddingService not initialized — call init() first");
    const res = await fetch(`${this.baseUrl}/embed/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts }),
    });
    if (!res.ok) throw new Error(`Embedding service error: ${res.status} ${res.statusText}`);
    const { embeddings } = (await res.json()) as { embeddings: number[][] };
    return embeddings;
  }

  /** Cross-encoder reranking — returns relevance scores for each passage (same order as input) */
  async rerank(query: string, passages: string[]): Promise<number[]> {
    if (!this.baseUrl) throw new Error("EmbeddingService not initialized — call init() first");
    const res = await fetch(`${this.baseUrl}/rerank`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, passages }),
    });
    if (!res.ok) throw new Error(`Reranking service error: ${res.status} ${res.statusText}`);
    const { scores } = (await res.json()) as { scores: number[] };
    return scores;
  }

  /** Batch cross-encoder reranking — one HTTP call for all queries */
  async rerankBatch(pairs: { query: string; passages: string[] }[]): Promise<number[][]> {
    if (!this.baseUrl) throw new Error("EmbeddingService not initialized — call init() first");
    const res = await fetch(`${this.baseUrl}/rerank/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        queries: pairs.map((p) => p.query),
        passages: pairs.map((p) => p.passages),
      }),
    });
    if (!res.ok) throw new Error(`Reranking service error: ${res.status} ${res.statusText}`);
    const { scores } = (await res.json()) as { scores: number[][] };
    return scores;
  }
}
