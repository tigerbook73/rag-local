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

interface DocRow {
  corpus_id: string;
  beir_doc_id: string;
  title: string | null;
}

interface ChunkWithEmbedding {
  corpus_id: string;
  chunk_index: number;
  content: string;
  embedding: string;
}

export async function cmdInject(opts: InjectOptions): Promise<void> {
  const { dataset, model, strategy, chunkSize, chunkOverlap } = opts;
  const chunkingConfig = buildChunkingConfig(strategy, chunkSize, chunkOverlap);
  let failed = false;
  try {
    console.log(`[inject] dataset=${dataset} model=${model} chunking=${chunkingConfig}`);

    const existing = await prisma.document.count({ where: { beirSource: dataset } });
    if (existing > 0) {
      throw new Error(`"${dataset}" already injected (${existing} docs). Run "eject" first.`);
    }

    const docs = await prisma.$queryRawUnsafe<DocRow[]>(
      `SELECT DISTINCT c.id AS corpus_id, c.beir_doc_id, c.title
       FROM beir_corpus c
       JOIN beir_corpus_chunks ch ON ch.corpus_id = c.id AND ch.chunking_config = $1
       JOIN beir_corpus_embeddings e ON e.chunk_id = ch.id AND e.model = $2
       WHERE c.dataset = $3
       ORDER BY c.beir_doc_id`,
      chunkingConfig,
      model,
      dataset,
    );
    console.log(`[inject] ${docs.length} documents...`);

    const corpusToDocId = new Map<string, string>();
    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i]!;
      const [row] = await prisma.$queryRawUnsafe<{ id: string }[]>(
        `INSERT INTO documents
           (id, filename, file_type, storage_path, status, chunking_strategy, chunk_size, chunk_overlap, beir_source)
         VALUES
           (gen_random_uuid(), $1, 'txt', $2, 'done', $3, $4, $5, $6)
         RETURNING id`,
        doc.title || doc.beir_doc_id,
        `beir/${dataset}/${doc.beir_doc_id}`,
        strategy,
        chunkSize,
        chunkOverlap,
        dataset,
      );
      corpusToDocId.set(doc.corpus_id, row!.id);
      if ((i + 1) % 200 === 0 || i + 1 === docs.length)
        printProgress(i + 1, docs.length, "documents");
    }

    const chunks = await prisma.$queryRawUnsafe<ChunkWithEmbedding[]>(
      `SELECT ch.corpus_id, ch.chunk_index, ch.content, e.embedding::text
       FROM beir_corpus_chunks ch
       JOIN beir_corpus_embeddings e ON e.chunk_id = ch.id AND e.model = $1
       JOIN beir_corpus c ON c.id = ch.corpus_id AND c.dataset = $2
       WHERE ch.chunking_config = $3
       ORDER BY ch.corpus_id, ch.chunk_index`,
      model,
      dataset,
      chunkingConfig,
    );

    console.log(`[inject] ${chunks.length} chunks...`);
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]!;
      const docId = corpusToDocId.get(chunk.corpus_id);
      if (!docId) continue;
      await prisma.$executeRawUnsafe(
        `INSERT INTO chunks (id, document_id, content, embedding, chunk_index)
         VALUES (gen_random_uuid(), $1::uuid, $2, $3::vector, $4)`,
        docId,
        chunk.content,
        chunk.embedding,
        chunk.chunk_index,
      );
      if ((i + 1) % 500 === 0 || i + 1 === chunks.length)
        printProgress(i + 1, chunks.length, "chunks");
    }
    console.log(`[inject] done — ${docs.length} docs, ${chunks.length} chunks injected.`);
  } catch (err) {
    console.error(`[inject] ${err instanceof Error ? err.message : String(err)}`);
    failed = true;
  } finally {
    await prisma.$disconnect();
  }
  if (failed) process.exit(1);
}
