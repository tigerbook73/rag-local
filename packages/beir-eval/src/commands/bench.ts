import { EmbeddingService } from "@rag-local/core";

interface BenchOptions {
  batchSizes: number[];
  sampleSize: number;
  chunkSize: number;
  rounds: number;
}

interface BenchResult {
  batchSize: number;
  throughput: number; // chunks/sec
  latencyMs: number; // ms per chunk
  totalMs: number; // ms for sampleSize chunks
  error?: string;
}

/** Generate deterministic fake text of roughly `length` chars */
function makeSample(length: number, seed: number): string {
  const words = [
    "the",
    "scientific",
    "evidence",
    "suggests",
    "that",
    "protein",
    "expression",
    "in",
    "cancer",
    "cells",
    "may",
    "vary",
    "depending",
    "on",
    "environmental",
    "factors",
    "such",
    "as",
    "temperature",
    "and",
    "chemical",
    "composition",
  ];
  let text = "";
  let i = seed;
  while (text.length < length) {
    text += words[i % words.length] + " ";
    i++;
  }
  return text.slice(0, length);
}

export async function cmdBench(opts: BenchOptions): Promise<void> {
  const { batchSizes, sampleSize, chunkSize, rounds } = opts;

  const embeddingService = new EmbeddingService();
  embeddingService.init();

  const samples = Array.from({ length: sampleSize }, (_, i) => makeSample(chunkSize, i));

  console.log(
    `[bench] sidecar: ${process.env["EMBEDDING_SERVICE_URL"] ?? "http://localhost:8000"}`,
  );
  console.log(`[bench] sample_size=${sampleSize}  chunk_chars=${chunkSize}  rounds=${rounds}`);

  // Warmup
  process.stdout.write("[bench] warming up... ");
  try {
    await embeddingService.embedBatch(samples.slice(0, 16));
    console.log("ok");
  } catch (err) {
    console.log("failed");
    console.error(`[bench] warmup error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  const results: BenchResult[] = [];

  console.log(
    `\n${"batch".padEnd(8)} ${"chunks/s".padStart(10)} ${"ms/chunk".padStart(10)} ${"total(ms)".padStart(12)}`,
  );
  console.log("-".repeat(44));

  for (const batchSize of batchSizes) {
    const timings: number[] = [];
    let errorMsg: string | undefined;

    process.stdout.write(`  testing batch=${batchSize}...`);
    for (let r = 0; r < rounds; r++) {
      const t0 = performance.now();
      try {
        for (let i = 0; i < sampleSize; i += batchSize) {
          await embeddingService.embedBatch(samples.slice(i, i + batchSize));
        }
        timings.push(performance.now() - t0);
      } catch (err) {
        errorMsg = err instanceof Error ? err.message : String(err);
        break;
      }
    }
    process.stdout.write("\r" + " ".repeat(30) + "\r");

    if (errorMsg || timings.length === 0) {
      const result: BenchResult = {
        batchSize,
        throughput: 0,
        latencyMs: 0,
        totalMs: 0,
        error: errorMsg ?? "no timings",
      };
      results.push(result);
      console.log(
        `${String(batchSize).padEnd(8)} ${"ERROR".padStart(10)} ${"".padStart(10)} ${"".padStart(12)}  ← ${result.error}`,
      );
      break; // larger batches will also fail
    }

    const avgMs = timings.reduce((a, b) => a + b, 0) / timings.length;
    const throughput = (sampleSize / avgMs) * 1000;
    const latencyMs = avgMs / sampleSize;
    const result: BenchResult = { batchSize, throughput, latencyMs, totalMs: avgMs };
    results.push(result);
    console.log(
      `${String(batchSize).padEnd(8)} ${throughput.toFixed(1).padStart(10)} ${latencyMs.toFixed(2).padStart(10)} ${avgMs.toFixed(0).padStart(12)}`,
    );
  }

  // Recommendation: highest throughput among successful results
  const successful = results.filter((r) => !r.error);
  if (successful.length === 0) {
    console.log("\n[bench] all batch sizes failed — check sidecar logs.");
    return;
  }

  const best = successful.reduce((a, b) => (a.throughput > b.throughput ? a : b));
  console.log(
    `\n[bench] recommended --batch-size ${best.batchSize}  (${best.throughput.toFixed(1)} chunks/s)`,
  );
}
