export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  documentName: string;
  fileType: string;
  content: string;
  similarityScore: number;
  rerankScore?: number;
  metadata?: Record<string, unknown> | null;
}

export interface LatencyInfo {
  ttftMs: number;
  totalMs: number;
  retrievalMs: number;
}
