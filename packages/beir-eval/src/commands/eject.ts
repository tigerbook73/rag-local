import { prisma } from "@rag-local/db";

export async function cmdEject(dataset: string): Promise<void> {
  let failed = false;
  try {
    console.log(`[eject] dataset=${dataset}`);
    const { count } = await prisma.document.deleteMany({
      where: { fileType: "dataset", filename: dataset },
    });
    console.log(`[eject] removed ${count} document (chunks cascade).`);
  } catch (err) {
    console.error(`[eject] ${err instanceof Error ? err.message : String(err)}`);
    failed = true;
  } finally {
    await prisma.$disconnect();
  }
  if (failed) process.exit(1);
}
