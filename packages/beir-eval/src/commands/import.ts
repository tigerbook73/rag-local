import { prisma } from "@rag-local/db";
import { fetchCorpus, fetchQueries, fetchQrels } from "../libs/hf-client.js";
import { printProgress } from "../libs/progress.js";

export async function cmdImport(dataset: string): Promise<void> {
  console.log(`[import] dataset=${dataset}`);

  let corpusCount = 0;
  for await (const { rows, total } of fetchCorpus(dataset)) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO beir_corpus (id, dataset, beir_doc_id, title, text)
       SELECT gen_random_uuid(), $1, beir_doc_id, title, text
       FROM jsonb_to_recordset($2::jsonb) AS t(beir_doc_id text, title text, text text)
       ON CONFLICT (dataset, beir_doc_id) DO NOTHING`,
      dataset,
      JSON.stringify(
        rows.map((r) => ({
          beir_doc_id: r._id,
          title: r.title ?? "",
          text: r.text,
        })),
      ),
    );
    corpusCount += rows.length;
    printProgress(corpusCount, total, "corpus");
  }

  let queryCount = 0;
  for await (const { rows, total } of fetchQueries(dataset)) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO beir_queries (id, dataset, beir_query_id, text)
       SELECT gen_random_uuid(), $1, beir_query_id, text
       FROM jsonb_to_recordset($2::jsonb) AS t(beir_query_id text, text text)
       ON CONFLICT (dataset, beir_query_id) DO NOTHING`,
      dataset,
      JSON.stringify(rows.map((r) => ({ beir_query_id: r._id, text: r.text }))),
    );
    queryCount += rows.length;
    printProgress(queryCount, total, "queries");
  }

  let qrelCount = 0;
  for await (const { rows, total } of fetchQrels(dataset)) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO beir_qrels (dataset, query_id, doc_id, relevance)
       SELECT $1, query_id, doc_id, relevance
       FROM jsonb_to_recordset($2::jsonb) AS t(query_id text, doc_id text, relevance int)
       ON CONFLICT (dataset, query_id, doc_id) DO NOTHING`,
      dataset,
      JSON.stringify(
        rows.map((r) => ({
          query_id: r["query-id"],
          doc_id: r["corpus-id"],
          relevance: r.score,
        })),
      ),
    );
    qrelCount += rows.length;
    printProgress(qrelCount, total, "qrels");
  }

  console.log(`[import] done — corpus=${corpusCount} queries=${queryCount} qrels=${qrelCount}`);
  await prisma.$disconnect();
}
