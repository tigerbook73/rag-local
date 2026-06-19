import { prisma } from "@rag-local/db";

interface CorpusStats {
  dataset: string;
  n: bigint;
}

interface ChunkStats {
  dataset: string;
  chunking_config: string;
  chunk_count: bigint;
  chunked_docs: bigint;
}

interface EmbStats {
  dataset: string;
  chunking_config: string;
  model: string;
  emb_count: bigint;
}

interface EvalRunStats {
  dataset: string;
  embedding_config: string;
  run_count: bigint;
  latest_at: Date;
  latest_metrics: Record<string, number>;
}

export async function cmdStatus(dataset?: string): Promise<void> {
  const dsFilter = dataset ? `WHERE dataset = $1` : "";
  const dsJoinFilter = dataset ? `WHERE c.dataset = $1` : "";
  const args = dataset ? [dataset] : [];
  let failed = false;
  try {
    const corpusRows = await prisma.$queryRawUnsafe<CorpusStats[]>(
      `SELECT dataset, COUNT(*)::bigint as n FROM beir_corpus ${dsFilter} GROUP BY dataset ORDER BY dataset`,
      ...args,
    );

    if (corpusRows.length === 0) {
      console.log(
        "No BEIR data found. Import a dataset first:\n  beir-eval import --dataset <name>",
      );
      return;
    }

    const chunkRows = await prisma.$queryRawUnsafe<ChunkStats[]>(
      `SELECT c.dataset, ch.chunking_config,
         COUNT(*)::bigint                   as chunk_count,
         COUNT(DISTINCT ch.corpus_id)::bigint as chunked_docs
       FROM beir_corpus_chunks ch
       JOIN beir_corpus c ON c.id = ch.corpus_id
       ${dsJoinFilter}
       GROUP BY c.dataset, ch.chunking_config
       ORDER BY c.dataset, ch.chunking_config`,
      ...args,
    );

    const embRows = await prisma.$queryRawUnsafe<EmbStats[]>(
      `SELECT c.dataset, ch.chunking_config, e.model,
         COUNT(*)::bigint as emb_count
       FROM beir_corpus_embeddings e
       JOIN beir_corpus_chunks ch ON ch.id = e.chunk_id
       JOIN beir_corpus c ON c.id = ch.corpus_id
       ${dsJoinFilter}
       GROUP BY c.dataset, ch.chunking_config, e.model
       ORDER BY c.dataset, ch.chunking_config, e.model`,
      ...args,
    );

    const evalRows = await prisma.$queryRawUnsafe<EvalRunStats[]>(
      `SELECT dataset, embedding_config,
         COUNT(*)::bigint as run_count,
         MAX(created_at)  as latest_at,
         (SELECT metrics FROM beir_eval_runs r2
          WHERE r2.dataset = r.dataset AND r2.embedding_config = r.embedding_config
          ORDER BY r2.created_at DESC LIMIT 1) as latest_metrics
       FROM beir_eval_runs r
       ${dsFilter}
       GROUP BY dataset, embedding_config
       ORDER BY dataset, embedding_config`,
      ...args,
    );

    for (const corpus of corpusRows) {
      const ds = corpus.dataset;
      const corpusCount = Number(corpus.n);
      console.log(`\nDataset: ${ds}`);
      console.log(`  corpus:  ${corpusCount.toLocaleString()} docs`);

      const dsChunks = chunkRows.filter((r) => r.dataset === ds);
      if (dsChunks.length === 0) {
        console.log(`  chunks:  none`);
        console.log(`    → run: beir-eval embed --dataset ${ds}`);
      } else {
        console.log(`  chunks:`);
        for (const c of dsChunks) {
          const chunks = Number(c.chunk_count);
          const chunkedDocs = Number(c.chunked_docs);
          const complete = chunkedDocs >= corpusCount;
          const status = complete
            ? "✓ complete"
            : `⟳ incomplete (${chunkedDocs}/${corpusCount} docs) — resumable`;
          console.log(
            `    ${c.chunking_config.padEnd(22)} ${chunks.toLocaleString().padStart(7)} chunks  ${status}`,
          );
        }
      }

      const dsEmb = embRows.filter((r) => r.dataset === ds);
      if (dsEmb.length === 0) {
        console.log(`  embeddings: none`);
      } else {
        console.log(`  embeddings:`);
        for (const e of dsEmb) {
          const embedded = Number(e.emb_count);
          const chunkRow = dsChunks.find((c) => c.chunking_config === e.chunking_config);
          const totalChunks = chunkRow ? Number(chunkRow.chunk_count) : "?";
          const complete = typeof totalChunks === "number" && embedded >= totalChunks;
          const status = complete
            ? "✓ complete"
            : `⟳ incomplete (${embedded}/${totalChunks}) — resumable`;
          console.log(`    ${e.model} × ${e.chunking_config.padEnd(22)} ${status}`);
        }
      }

      const dsEval = evalRows.filter((r) => r.dataset === ds);
      if (dsEval.length > 0) {
        console.log(`  eval runs:`);
        for (const r of dsEval) {
          const m = r.latest_metrics;
          const ndcg = m["ndcg@10"] !== undefined ? `ndcg@10=${m["ndcg@10"].toFixed(4)}` : "";
          const date = new Date(r.latest_at).toISOString().slice(0, 10);
          console.log(
            `    ${r.embedding_config.padEnd(32)} ${Number(r.run_count)} run(s)  latest: ${ndcg}  (${date})`,
          );
        }
      }
    }

    console.log("");
  } catch (err) {
    console.error(`[status] ${err instanceof Error ? err.message : String(err)}`);
    failed = true;
  } finally {
    await prisma.$disconnect();
  }
  if (failed) process.exit(1);
}
