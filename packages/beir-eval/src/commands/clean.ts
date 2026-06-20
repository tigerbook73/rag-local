import { prisma } from "@rag-local/db";

export async function cmdClean(dataset: string): Promise<void> {
  let failed = false;
  try {
    console.log(`[clean] dataset=${dataset}`);

    // beir_corpus CASCADE → beir_corpus_chunks → beir_corpus_embeddings
    const { count: corpusCount } = await prisma.beirCorpus.deleteMany({ where: { dataset } });
    const { count: queryCount } = await prisma.beirQuery.deleteMany({ where: { dataset } });
    await prisma.$executeRawUnsafe(`DELETE FROM beir_qrels WHERE dataset = $1`, dataset);
    const { count: runCount } = await prisma.beirEvalRun.deleteMany({ where: { dataset } });

    console.log(
      `[clean] removed ${corpusCount} corpus docs, ${queryCount} queries, ${runCount} eval runs (chunks/embeddings cascade).`,
    );
  } catch (err) {
    console.error(`[clean] ${err instanceof Error ? err.message : String(err)}`);
    failed = true;
  } finally {
    await prisma.$disconnect();
  }
  if (failed) process.exit(1);
}
