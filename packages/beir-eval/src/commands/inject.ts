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

    const chunks = await prisma.$queryRawUnsafe<ChunkWithSource[]>(
      `SELECT
         ROW_NUMBER() OVER (ORDER BY c.beir_doc_id, ch.chunk_index) - 1 AS global_index,
         ch.content,
         e.embedding::text,
         c.beir_doc_id,
         c.title
       FROM beir_corpus_chunks ch
       JOIN beir_corpus_embeddings e ON e.chunk_id = ch.id AND e.model = $1
       JOIN beir_corpus c ON c.id = ch.corpus_id AND c.dataset = $2
       WHERE ch.chunking_config = $3
       ORDER BY c.beir_doc_id, ch.chunk_index`,
      model,
      dataset,
      chunkingConfig,
    );

    console.log(`[inject] inserting ${chunks.length} chunks...`);
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]!;
      await prisma.$executeRawUnsafe(
        `INSERT INTO chunks (id, document_id, content, embedding, chunk_index, metadata)
         VALUES (gen_random_uuid(), $1::uuid, $2, $3::vector, $4, $5::jsonb)`,
        docId,
        chunk.content,
        chunk.embedding,
        Number(chunk.global_index),
        JSON.stringify({ beirDocId: chunk.beir_doc_id, title: chunk.title }),
      );
      if ((i + 1) % 500 === 0 || i + 1 === chunks.length)
        printProgress(i + 1, chunks.length, "chunks");
    }
    console.log(`[inject] done — 1 document, ${chunks.length} chunks injected.`);
  } catch (err) {
    console.error(`[inject] ${err instanceof Error ? err.message : String(err)}`);
    failed = true;
  } finally {
    await prisma.$disconnect();
  }
  if (failed) process.exit(1);
}
