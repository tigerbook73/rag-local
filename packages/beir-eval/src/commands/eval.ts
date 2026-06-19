import { prisma } from "@rag-local/db";
import { EmbeddingService } from "@rag-local/core";
import { ndcgAtK, recallAtK, mrrAtK } from "../libs/metrics.js";
import { printProgress } from "../libs/progress.js";

interface EvalOptions {
  dataset: string;
  model: string;
  strategy: "fixed" | "semantic";
  chunkSize: number;
  chunkOverlap: number;
}

interface QueryRow {
  beir_query_id: string;
  text: string;
}

interface QrelRow {
  query_id: string;
  doc_id: string;
  relevance: number;
}

interface HitRow {
  beir_doc_id: string;
  score: number;
}

function vecStr(v: number[]): string {
  return `[${v.join(",")}]`;
}

export async function cmdEval(opts: EvalOptions): Promise<void> {
  const { dataset, model, strategy, chunkSize, chunkOverlap } = opts;
  const chunkingConfig = `${strategy}-${chunkSize}-${chunkOverlap}`;
  const embeddingConfig = `${model}/${chunkingConfig}`;
  console.log(`[eval] dataset=${dataset} config=${embeddingConfig}`);

  const embeddingService = new EmbeddingService();
  embeddingService.init();

  const queries = await prisma.$queryRawUnsafe<QueryRow[]>(
    `SELECT beir_query_id, text FROM beir_queries WHERE dataset = $1 ORDER BY beir_query_id`,
    dataset,
  );
  if (queries.length === 0) {
    console.error(`[eval] no queries found — run "import" first`);
    process.exit(1);
  }
  console.log(`[eval] ${queries.length} queries (full set)`);

  const qrelRows = await prisma.$queryRawUnsafe<QrelRow[]>(
    `SELECT query_id, doc_id, relevance FROM beir_qrels WHERE dataset = $1`,
    dataset,
  );
  const qrels = new Map<string, Map<string, number>>();
  for (const r of qrelRows) {
    if (!qrels.has(r.query_id)) qrels.set(r.query_id, new Map());
    qrels.get(r.query_id)!.set(r.doc_id, r.relevance);
  }

  // Embed queries in batches to avoid overwhelming the sidecar
  const EMBED_BATCH = 32;
  console.log(`[eval] embedding ${queries.length} queries...`);
  const queryEmbeddings: number[][] = [];
  for (let i = 0; i < queries.length; i += EMBED_BATCH) {
    const batch = queries.slice(i, i + EMBED_BATCH);
    const embs = await embeddingService.embedBatch(batch.map((q) => q.text));
    queryEmbeddings.push(...embs);
    printProgress(Math.min(i + EMBED_BATCH, queries.length), queries.length, "embedding queries");
  }
  console.log(`[eval] searching...`);

  const agg = { ndcg10: 0, recall10: 0, recall100: 0, mrr10: 0 };
  const queryDetails: {
    query_id: string;
    query_text: string;
    hits: { docId: string; score: number }[];
    ndcg10: number;
    relevant_in_top10: number;
  }[] = [];

  for (let i = 0; i < queries.length; i++) {
    const q = queries[i]!;
    const qEmb = queryEmbeddings[i]!;

    // Chunk-level retrieval aggregated to doc level (max score per doc)
    const hits = await prisma.$queryRawUnsafe<HitRow[]>(
      `SELECT c.beir_doc_id,
              MAX(1.0 - (e.embedding <=> $1::vector))::float AS score
       FROM beir_corpus_embeddings e
       JOIN beir_corpus_chunks ch ON ch.id = e.chunk_id
                                  AND ch.chunking_config = $2
       JOIN beir_corpus c ON c.id = ch.corpus_id AND c.dataset = $3
       WHERE e.model = $4
       GROUP BY c.beir_doc_id
       ORDER BY score DESC
       LIMIT 100`,
      vecStr(qEmb),
      chunkingConfig,
      dataset,
      model,
    );

    const hitIds = hits.map((h) => h.beir_doc_id);
    const relevant = qrels.get(q.beir_query_id) ?? new Map<string, number>();
    const relevantSet = new Set([...relevant.entries()].filter(([, r]) => r >= 1).map(([d]) => d));

    const n10 = ndcgAtK(hitIds, relevant, 10);
    agg.ndcg10 += n10;
    agg.recall10 += recallAtK(hitIds, relevantSet, 10);
    agg.recall100 += recallAtK(hitIds, relevantSet, 100);
    agg.mrr10 += mrrAtK(hitIds, relevantSet, 10);

    queryDetails.push({
      query_id: q.beir_query_id,
      query_text: q.text,
      hits: hits.slice(0, 20).map((h) => ({ docId: h.beir_doc_id, score: h.score })),
      ndcg10: n10,
      relevant_in_top10: hitIds.slice(0, 10).filter((d) => relevantSet.has(d)).length,
    });

    printProgress(i + 1, queries.length, "queries");
  }

  const n = queries.length;
  const finalMetrics = {
    "ndcg@10": +(agg.ndcg10 / n).toFixed(6),
    "recall@10": +(agg.recall10 / n).toFixed(6),
    "recall@100": +(agg.recall100 / n).toFixed(6),
    "mrr@10": +(agg.mrr10 / n).toFixed(6),
  };

  console.log("\n── Results ──────────────────────────────");
  for (const [k, v] of Object.entries(finalMetrics)) {
    console.log(`  ${k.padEnd(12)}: ${v.toFixed(4)}`);
  }
  console.log("─────────────────────────────────────────\n");

  const run = await prisma.beirEvalRun.create({
    data: { dataset, embeddingConfig, sampleSize: n, metrics: finalMetrics },
  });

  await prisma.$executeRawUnsafe(
    `INSERT INTO beir_eval_run_details
       (id, run_id, query_id, query_text, hits, ndcg10, relevant_in_top10)
     SELECT gen_random_uuid(), $1::uuid, query_id, query_text,
            hits::jsonb, ndcg10::decimal(5,4), relevant_in_top10
     FROM jsonb_to_recordset($2::jsonb) AS t(
       query_id text, query_text text, hits jsonb,
       ndcg10 float, relevant_in_top10 int
     )`,
    run.id,
    JSON.stringify(queryDetails),
  );

  console.log(`[eval] run saved: ${run.id}`);
  await prisma.$disconnect();
}
