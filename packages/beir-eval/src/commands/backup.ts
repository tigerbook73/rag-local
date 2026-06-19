import { createWriteStream } from "fs";
import { mkdir } from "fs/promises";
import path from "path";
import { prisma } from "@rag-local/db";
import { printProgress } from "../libs/progress.js";

const BATCH = 1000;
const EMB_BATCH = 500;

interface BackupOptions {
  dataset: string;
  output: string;
}

function writeLine(stream: ReturnType<typeof createWriteStream>, obj: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const ok = stream.write(JSON.stringify(obj) + "\n", "utf8");
    if (ok) resolve();
    else stream.once("drain", resolve);
    stream.once("error", reject);
  });
}

async function closeStream(stream: ReturnType<typeof createWriteStream>): Promise<void> {
  return new Promise((resolve, reject) => {
    stream.end((err?: Error | null) => (err ? reject(err) : resolve()));
  });
}

export async function cmdBackup({ dataset, output }: BackupOptions): Promise<void> {
  const dir = path.join(output, dataset);
  await mkdir(dir, { recursive: true });
  console.log(`[backup] dataset=${dataset}  output=${dir}`);

  // ── 1. Corpus ────────────────────────────────────────────────────────────
  {
    interface Row { id: string; beir_doc_id: string; title: string | null; text: string; }

    const [{ n }] = await prisma.$queryRawUnsafe<[{ n: bigint }]>(
      `SELECT COUNT(*)::bigint as n FROM beir_corpus WHERE dataset = $1`,
      dataset,
    );
    const total = Number(n);

    const stream = createWriteStream(path.join(dir, "corpus.jsonl"));
    let written = 0;
    for (let offset = 0; offset < total; offset += BATCH) {
      const rows = await prisma.$queryRawUnsafe<Row[]>(
        `SELECT id::text, beir_doc_id, title, text
         FROM beir_corpus WHERE dataset = $1 ORDER BY id LIMIT ${BATCH} OFFSET ${offset}`,
        dataset,
      );
      for (const row of rows) await writeLine(stream, { ...row, dataset });
      written += rows.length;
      printProgress(written, total, "corpus");
    }
    await closeStream(stream);
    console.log(`[backup] corpus: ${written} docs`);
  }

  // ── 2. Chunks ────────────────────────────────────────────────────────────
  {
    interface Row { id: string; corpus_id: string; chunk_index: number; content: string; chunking_config: string; }

    const [{ n }] = await prisma.$queryRawUnsafe<[{ n: bigint }]>(
      `SELECT COUNT(*)::bigint as n
       FROM beir_corpus_chunks ch JOIN beir_corpus c ON c.id = ch.corpus_id
       WHERE c.dataset = $1`,
      dataset,
    );
    const total = Number(n);

    const stream = createWriteStream(path.join(dir, "chunks.jsonl"));
    let written = 0;
    for (let offset = 0; offset < total; offset += BATCH) {
      const rows = await prisma.$queryRawUnsafe<Row[]>(
        `SELECT ch.id::text, ch.corpus_id::text, ch.chunk_index, ch.content, ch.chunking_config
         FROM beir_corpus_chunks ch JOIN beir_corpus c ON c.id = ch.corpus_id
         WHERE c.dataset = $1 ORDER BY ch.id LIMIT ${BATCH} OFFSET ${offset}`,
        dataset,
      );
      for (const row of rows) await writeLine(stream, row);
      written += rows.length;
      printProgress(written, total, "chunks");
    }
    await closeStream(stream);
    console.log(`[backup] chunks: ${written} chunks`);
  }

  // ── 3. Embeddings (corpus + eval excluded — only corpus embeddings) ───────
  {
    interface Row { chunk_id: string; model: string; embedding: string; }

    const [{ n }] = await prisma.$queryRawUnsafe<[{ n: bigint }]>(
      `SELECT COUNT(*)::bigint as n
       FROM beir_corpus_embeddings e
       JOIN beir_corpus_chunks ch ON ch.id = e.chunk_id
       JOIN beir_corpus c ON c.id = ch.corpus_id
       WHERE c.dataset = $1`,
      dataset,
    );
    const total = Number(n);

    const stream = createWriteStream(path.join(dir, "embeddings.jsonl"));
    let written = 0;
    for (let offset = 0; offset < total; offset += EMB_BATCH) {
      const rows = await prisma.$queryRawUnsafe<Row[]>(
        `SELECT e.chunk_id::text, e.model, e.embedding::text as embedding
         FROM beir_corpus_embeddings e
         JOIN beir_corpus_chunks ch ON ch.id = e.chunk_id
         JOIN beir_corpus c ON c.id = ch.corpus_id
         WHERE c.dataset = $1 ORDER BY e.chunk_id LIMIT ${EMB_BATCH} OFFSET ${offset}`,
        dataset,
      );
      for (const row of rows) await writeLine(stream, row);
      written += rows.length;
      printProgress(written, total, "embeddings");
    }
    await closeStream(stream);
    console.log(`[backup] embeddings: ${written} vectors`);
  }

  console.log("[backup] done.");
  await prisma.$disconnect();
}
