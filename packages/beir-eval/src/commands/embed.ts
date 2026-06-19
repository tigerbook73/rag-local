import { prisma } from "@rag-local/db";
import { createChunkingStrategy, EmbeddingService } from "@rag-local/core";
import { printProgress } from "../libs/progress.js";

interface EmbedOptions {
  dataset: string;
  model: string;
  strategy: "fixed" | "semantic";
  chunkSize: number;
  chunkOverlap: number;
  batchSize: number;
}

interface CorpusRow {
  id: string;
  text: string;
}

interface ChunkRow {
  id: string;
  content: string;
}

function vecStr(v: number[]): string {
  return `[${v.join(",")}]`;
}

export async function cmdEmbed(opts: EmbedOptions): Promise<void> {
  const { dataset, model, strategy, chunkSize, chunkOverlap, batchSize } = opts;
  const chunkingConfig = `${strategy}-${chunkSize}-${chunkOverlap}`;
  console.log(`[embed] dataset=${dataset} model=${model} chunking=${chunkingConfig}`);

  const embeddingService = new EmbeddingService();
  embeddingService.init();

  const chunker = createChunkingStrategy({
    strategy,
    chunkSize,
    chunkOverlap,
  });

  // Step 1: chunk docs that have no chunks for this chunking config yet
  const docs = await prisma.$queryRawUnsafe<CorpusRow[]>(
    `SELECT c.id, c.text
     FROM beir_corpus c
     WHERE c.dataset = $1
       AND NOT EXISTS (
         SELECT 1 FROM beir_corpus_chunks ch
         WHERE ch.corpus_id = c.id AND ch.chunking_config = $2
       )`,
    dataset,
    chunkingConfig,
  );

  if (docs.length > 0) {
    console.log(`[embed] chunking ${docs.length} docs (${chunkingConfig})...`);
    let done = 0;
    for (const doc of docs) {
      const chunks = chunker.chunk(doc.text);
      for (const chunk of chunks) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO beir_corpus_chunks (id, corpus_id, chunk_index, content, chunking_config)
           VALUES (gen_random_uuid(), $1::uuid, $2, $3, $4)
           ON CONFLICT (corpus_id, chunk_index, chunking_config) DO NOTHING`,
          doc.id,
          chunk.index,
          chunk.content,
          chunkingConfig,
        );
      }
      done++;
      if (done % 500 === 0 || done === docs.length) {
        printProgress(done, docs.length, "chunking");
      }
    }
  }

  // Step 2: embed chunks that don't have an embedding for this model yet
  const chunks = await prisma.$queryRawUnsafe<ChunkRow[]>(
    `SELECT ch.id, ch.content
     FROM beir_corpus_chunks ch
     JOIN beir_corpus c ON c.id = ch.corpus_id AND c.dataset = $1
     WHERE ch.chunking_config = $2
       AND NOT EXISTS (
         SELECT 1 FROM beir_corpus_embeddings e
         WHERE e.chunk_id = ch.id AND e.model = $3
       )`,
    dataset,
    chunkingConfig,
    model,
  );

  console.log(`[embed] embedding ${chunks.length} chunks (model=${model}, batch=${batchSize})...`);

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const embeddings = await embeddingService.embedBatch(batch.map((c) => c.content));
    for (let j = 0; j < batch.length; j++) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO beir_corpus_embeddings (id, chunk_id, model, embedding)
         VALUES (gen_random_uuid(), $1::uuid, $2, $3::vector)
         ON CONFLICT (chunk_id, model) DO UPDATE SET embedding = EXCLUDED.embedding`,
        batch[j]!.id,
        model,
        vecStr(embeddings[j]!),
      );
    }
    printProgress(Math.min(i + batchSize, chunks.length), chunks.length, "embedding");
  }
  console.log("[embed] done.");
  await prisma.$disconnect();
}
