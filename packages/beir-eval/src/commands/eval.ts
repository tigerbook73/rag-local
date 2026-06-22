import { prisma } from "@rag-local/db";
import { EmbeddingService } from "@rag-local/core";
import { ndcgAtK, recallAtK, mrrAtK } from "../libs/metrics.js";
import { printProgress } from "../libs/progress.js";
import { vecStr, buildChunkingConfig } from "../libs/utils.js";

export type RetrievalMode = "dense" | "bm25" | "hybrid";

interface EvalOptions {
  dataset: string;
  model: string;
  strategy: "fixed" | "semantic";
  chunkSize: number;
  chunkOverlap: number;
  retrieval: RetrievalMode;
  rrfK: number;
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

const EMBED_BATCH = 32;

function buildEmbeddingConfig(opts: EvalOptions): string {
  const { retrieval, model, strategy, chunkSize, chunkOverlap, rrfK } = opts;
  if (retrieval === "bm25") return "bm25";
  const chunkingConfig = buildChunkingConfig(strategy, chunkSize, chunkOverlap);
  if (retrieval === "dense") return `${model}/${chunkingConfig}`;
  return `hybrid/${model}/${chunkingConfig}+bm25/rrf${rrfK}`;
}

async function fetchDenseHits(
  qEmb: number[],
  chunkingConfig: string,
  dataset: string,
  model: string,
  limit: number,
): Promise<HitRow[]> {
  return prisma.$queryRawUnsafe<HitRow[]>(
    `SELECT c.beir_doc_id,
            MAX(1.0 - (e.embedding <=> $1::vector))::float AS score
     FROM beir_corpus_embeddings e
     JOIN beir_corpus_chunks ch ON ch.id = e.chunk_id
                                AND ch.chunking_config = $2
     JOIN beir_corpus c ON c.id = ch.corpus_id AND c.dataset = $3
     WHERE e.model = $4
     GROUP BY c.beir_doc_id
     ORDER BY score DESC
     LIMIT $5`,
    vecStr(qEmb),
    chunkingConfig,
    dataset,
    model,
    limit,
  );
}

async function fetchBm25Hits(
  queryText: string,
  dataset: string,
  limit: number,
): Promise<HitRow[]> {
  // plainto_tsquery handles arbitrary text safely; $1 appears twice but is passed once.
  return prisma.$queryRawUnsafe<HitRow[]>(
    `SELECT beir_doc_id,
            ts_rank_cd(fts, plainto_tsquery('english', $1))::float AS score
     FROM beir_corpus
     WHERE dataset = $2
       AND fts @@ plainto_tsquery('english', $1)
     ORDER BY score DESC
     LIMIT $3`,
    queryText,
    dataset,
    limit,
  );
}

function fuseRRF(denseHits: HitRow[], bm25Hits: HitRow[], k: number): HitRow[] {
  const scores = new Map<string, number>();

  for (let rank = 0; rank < denseHits.length; rank++) {
    const docId = denseHits[rank]!.beir_doc_id;
    scores.set(docId, (scores.get(docId) ?? 0) + 1 / (k + rank + 1));
  }
  for (let rank = 0; rank < bm25Hits.length; rank++) {
    const docId = bm25Hits[rank]!.beir_doc_id;
    scores.set(docId, (scores.get(docId) ?? 0) + 1 / (k + rank + 1));
  }

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([beir_doc_id, score]) => ({ beir_doc_id, score }));
}

export async function cmdEval(opts: EvalOptions): Promise<void> {
  const { dataset, model, strategy, chunkSize, chunkOverlap, retrieval, rrfK } = opts;
  const chunkingConfig = buildChunkingConfig(strategy, chunkSize, chunkOverlap);
  const embeddingConfig = buildEmbeddingConfig(opts);
  let failed = false;
  try {
    console.log(`[eval] dataset=${dataset} config=${embeddingConfig} retrieval=${retrieval}`);

    let embeddingService: EmbeddingService | null = null;
    if (retrieval !== "bm25") {
      embeddingService = new EmbeddingService();
      embeddingService.init();
    }

    const queries = await prisma.$queryRawUnsafe<QueryRow[]>(
      `SELECT beir_query_id, text FROM beir_queries WHERE dataset = $1 ORDER BY beir_query_id`,
      dataset,
    );
    if (queries.length === 0) throw new Error(`no queries found — run "import" first`);
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

    const queryEmbeddings: number[][] = [];
    if (retrieval !== "bm25") {
      console.log(`[eval] embedding ${queries.length} queries...`);
      for (let i = 0; i < queries.length; i += EMBED_BATCH) {
        const batch = queries.slice(i, i + EMBED_BATCH);
        const embs = await embeddingService!.embedBatch(batch.map((q) => q.text));
        queryEmbeddings.push(...embs);
        printProgress(Math.min(i + EMBED_BATCH, queries.length), queries.length, "embedding queries");
      }
    }
    console.log(`[eval] searching (${retrieval})...`);

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

      let hits: HitRow[];
      if (retrieval === "bm25") {
        hits = await fetchBm25Hits(q.text, dataset, 100);
      } else if (retrieval === "hybrid") {
        const [denseHits, bm25Hits] = await Promise.all([
          fetchDenseHits(queryEmbeddings[i]!, chunkingConfig, dataset, model, 100),
          fetchBm25Hits(q.text, dataset, 100),
        ]);
        hits = fuseRRF(denseHits, bm25Hits, rrfK).slice(0, 100);
      } else {
        hits = await fetchDenseHits(queryEmbeddings[i]!, chunkingConfig, dataset, model, 100);
      }

      const hitIds = hits.map((h) => h.beir_doc_id);
      const relevant = qrels.get(q.beir_query_id) ?? new Map<string, number>();
      const relevantSet = new Set(
        [...relevant.entries()].filter(([, r]) => r >= 1).map(([d]) => d),
      );

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
      ndcg10: +(agg.ndcg10 / n).toFixed(6),
      recall10: +(agg.recall10 / n).toFixed(6),
      recall100: +(agg.recall100 / n).toFixed(6),
      mrr10: +(agg.mrr10 / n).toFixed(6),
    };

    console.log("\n── Results ──────────────────────────────");
    console.log(`  nDCG@10     : ${finalMetrics.ndcg10.toFixed(4)}`);
    console.log(`  Recall@10   : ${finalMetrics.recall10.toFixed(4)}`);
    console.log(`  Recall@100  : ${finalMetrics.recall100.toFixed(4)}`);
    console.log(`  MRR@10      : ${finalMetrics.mrr10.toFixed(4)}`);
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
  } catch (err) {
    console.error(`[eval] ${err instanceof Error ? err.message : String(err)}`);
    failed = true;
  } finally {
    await prisma.$disconnect();
  }
  if (failed) process.exit(1);
}
