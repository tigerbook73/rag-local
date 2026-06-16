import type { FeatureExtractionPipeline } from "@huggingface/transformers";

export class EmbeddingService {
  private pipe: FeatureExtractionPipeline | null = null;

  /** Load BGE-M3 ONNX model. Call once at process startup before serving requests. */
  async init(): Promise<void> {
    // Dynamic import required: @huggingface/transformers is ESM-only
    const { pipeline, env } = await import("@huggingface/transformers");
    env.cacheDir = process.env["HF_HOME"] ?? "./.model-cache";
    this.pipe = await pipeline("feature-extraction", "Xenova/bge-m3", {
      dtype: "fp32",
    });
  }

  async embed(text: string): Promise<number[]> {
    if (!this.pipe) throw new Error("EmbeddingService not initialized — call init() first");
    const result = await this.pipe(text, { pooling: "cls", normalize: true });
    return Array.from(result.data as Float32Array);
  }

  /** Batch embedding — reduces model invocation overhead for document processing */
  async embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((t) => this.embed(t)));
  }
}
