import { prisma } from "@rag-local/db";
import { printProgress } from "../libs/progress.js";
import { buildChunkingConfig } from "../libs/utils.js";

interface InjectOptions {
  dataset: string;
  model: string;
  strategy: "fixed" | "semantic";
  chunkSize: number;
  chunkOverlap: number;
}

interface ChunkWithSource {
  global_index: bigint;
  content: string;
  embedding: string;
  beir_doc_id: string;
  chunk_index: number;
  title: string | null;
}

export async function cmdInject(opts: InjectOptions): Promise<void> {
  const { dataset, model, strategy, chunkSize, chunkOverlap } = opts;
  const chunkingConfig = buildChunkingConfig(strategy, chunkSize, chunkOverlap);
  let failed = false;
  try {
    console.log(`[inject] dataset=${dataset} model=${model} chunking=${chunkingConfig}`);

    const existing = await prisma.document.count({
      where: { fileType: "dataset", filename: dataset },
    });
    if (existing > 0) {
      throw new Error(`"${dataset}" already injected. Run "eject" first.`);
    }

    const [countRow] = await prisma.$queryRawUnsafe<{ total: bigint }[]>(
      `SELECT COUNT(*) AS total
       FROM beir_corpus_chunks ch
       JOIN beir_corpus_embeddings e ON e.chunk_id = ch.id AND e.model = $1
       JOIN beir_corpus c ON c.id = ch.corpus_id AND c.dataset = $2
       WHERE ch.chunking_config = $3`,
      model,
      dataset,
      chunkingConfig,
    );
    const totalChunks = Number(countRow!.total);
    if (totalChunks === 0) {
      throw new Error(
        `No embedded chunks found for dataset="${dataset}" model="${model}" chunking="${chunkingConfig}". Run "embed" first.`,
      );
    }
    console.log(`[inject] ${totalChunks} chunks → creating 1 document...`);

    const [docRow] = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `INSERT INTO documents
         (id, filename, file_type, storage_path, status, chunking_strategy, chunk_size, chunk_overlap,
          total_chunks, processed_chunks, processing_started_at, processing_completed_at)
       VALUES
         (gen_random_uuid(), $1, 'dataset'::"DocumentFiletype", $2, 'done', $3::"ChunkingStrategy",
          $4, $5, $6, $6, NOW(), NOW())
       RETURNING id`,
      dataset,
      `beir/${dataset}`,
      strategy,
      chunkSize,
      chunkOverlap,
      totalChunks,
    );
    const docId = docRow!.id;

    const BATCH_SIZE = 100;
    let inserted = 0;
    let cursorDocId = "";
    let cursorChunkIndex = -1;
    while (inserted < totalChunks) {
      const batch = await prisma.$queryRawUnsafe<ChunkWithSource[]>(
        `SELECT
           $5::bigint + ROW_NUMBER() OVER (ORDER BY c.beir_doc_id, ch.chunk_index) - 1 AS global_index,
           ch.content,
           e.embedding::text,
           c.beir_doc_id,
           ch.chunk_index,
           c.title
         FROM beir_corpus_chunks ch
         JOIN beir_corpus_embeddings e ON e.chunk_id = ch.id AND e.model = $1
         JOIN beir_corpus c ON c.id = ch.corpus_id AND c.dataset = $2
         WHERE ch.chunking_config = $3
           AND (c.beir_doc_id, ch.chunk_index) > ($6::text, $7::int)
         ORDER BY c.beir_doc_id, ch.chunk_index
         LIMIT $4`,
        model,
        dataset,
        chunkingConfig,
        BATCH_SIZE,
        inserted,
        cursorDocId,
        cursorChunkIndex,
      );
      if (batch.length === 0) break;
      const last = batch[batch.length - 1]!;
      cursorDocId = last.beir_doc_id;
      cursorChunkIndex = last.chunk_index;
      await prisma.$executeRawUnsafe(
        `INSERT INTO chunks (id, document_id, content, embedding, chunk_index, metadata)
         SELECT gen_random_uuid(), $1::uuid,
                item->>'content',
                (item->>'embedding')::vector,
                (item->>'chunk_index')::int,
                item->'metadata'
         FROM jsonb_array_elements($2::jsonb) AS item`,
        docId,
        JSON.stringify(
          batch.map((c) => ({
            content: c.content,
            embedding: c.embedding,
            chunk_index: Number(c.global_index),
            metadata: { beirDocId: c.beir_doc_id, title: c.title },
          })),
        ),
      );
      inserted += batch.length;
      printProgress(inserted, totalChunks, "chunks");
    }
    console.log(`[inject] done — 1 document, ${inserted} chunks injected.`);
  } catch (err) {
    console.error(`[inject] ${err instanceof Error ? err.message : String(err)}`);
    failed = true;
  } finally {
    await prisma.$disconnect();
  }
  if (failed) process.exit(1);
}
