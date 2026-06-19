import { createReadStream, existsSync } from "fs";
import { createInterface } from "readline";
import path from "path";
import { prisma } from "@rag-local/db";

interface RestoreOptions {
  dataset: string;
  input: string;
}

async function readJsonlBatched<T>(
  filePath: string,
  batchSize: number,
  onBatch: (batch: T[], processed: number) => Promise<void>,
): Promise<number> {
  if (!existsSync(filePath)) {
    console.warn(`[restore] skipping missing file: ${filePath}`);
    return 0;
  }

  const rl = createInterface({ input: createReadStream(filePath), crlfDelay: Infinity });
  let batch: T[] = [];
  let processed = 0;

  for await (const line of rl) {
    if (!line.trim()) continue;
    batch.push(JSON.parse(line) as T);
    if (batch.length >= batchSize) {
      processed += batch.length;
      await onBatch(batch, processed);
      batch = [];
    }
  }
  if (batch.length > 0) {
    processed += batch.length;
    await onBatch(batch, processed);
  }
  return processed;
}

export async function cmdRestore({ dataset, input }: RestoreOptions): Promise<void> {
  const dir = path.join(input, dataset);
  console.log(`[restore] dataset=${dataset}  input=${dir}`);

  // ── 1. Corpus ────────────────────────────────────────────────────────────
  interface CorpusRow {
    id: string;
    dataset: string;
    beir_doc_id: string;
    title: string | null;
    text: string;
  }

  const corpusCount = await readJsonlBatched<CorpusRow>(
    path.join(dir, "corpus.jsonl"),
    500,
    async (batch, processed) => {
      await prisma.$executeRawUnsafe(
        `INSERT INTO beir_corpus (id, dataset, beir_doc_id, title, text)
         SELECT t.id::uuid, t.dataset, t.beir_doc_id, t.title, t.text
         FROM jsonb_to_recordset($1::jsonb) AS t(id text, dataset text, beir_doc_id text, title text, text text)
         ON CONFLICT (dataset, beir_doc_id) DO NOTHING`,
        JSON.stringify(batch),
      );
      process.stdout.write(`\r[restore] corpus: ${processed} rows...`);
    },
  );
  console.log(`\r[restore] corpus: ${corpusCount} docs`);

  // ── 2. Chunks ────────────────────────────────────────────────────────────
  interface ChunkRow {
    id: string;
    corpus_id: string;
    chunk_index: number;
    content: string;
    chunking_config: string;
  }

  const chunkCount = await readJsonlBatched<ChunkRow>(
    path.join(dir, "chunks.jsonl"),
    500,
    async (batch, processed) => {
      await prisma.$executeRawUnsafe(
        `INSERT INTO beir_corpus_chunks (id, corpus_id, chunk_index, content, chunking_config)
         SELECT t.id::uuid, t.corpus_id::uuid, (t.chunk_index)::int, t.content, t.chunking_config
         FROM jsonb_to_recordset($1::jsonb) AS t(id text, corpus_id text, chunk_index int, content text, chunking_config text)
         ON CONFLICT (corpus_id, chunk_index, chunking_config) DO NOTHING`,
        JSON.stringify(batch),
      );
      process.stdout.write(`\r[restore] chunks: ${processed} rows...`);
    },
  );
  console.log(`\r[restore] chunks: ${chunkCount} chunks`);

  // ── 3. Embeddings ────────────────────────────────────────────────────────
  interface EmbRow {
    chunk_id: string;
    model: string;
    embedding: string;
  }

  const embCount = await readJsonlBatched<EmbRow>(
    path.join(dir, "embeddings.jsonl"),
    100, // smaller batch — each embedding text is ~10 KB
    async (batch, processed) => {
      await prisma.$executeRawUnsafe(
        `INSERT INTO beir_corpus_embeddings (id, chunk_id, model, embedding)
         SELECT gen_random_uuid(), t.chunk_id::uuid, t.model, t.embedding::vector
         FROM jsonb_to_recordset($1::jsonb) AS t(chunk_id text, model text, embedding text)
         ON CONFLICT (chunk_id, model) DO NOTHING`,
        JSON.stringify(batch),
      );
      process.stdout.write(`\r[restore] embeddings: ${processed} rows...`);
    },
  );
  console.log(`\r[restore] embeddings: ${embCount} vectors`);

  console.log("[restore] done.");
  await prisma.$disconnect();
}
