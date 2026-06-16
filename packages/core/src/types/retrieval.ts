export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  documentName: string;
  content: string;
  similarityScore: number;
  rerankScore?: number;
}

export interface LatencyInfo {
  ttftMs: number;
  totalMs: number;
  retrievalMs: number;
}
