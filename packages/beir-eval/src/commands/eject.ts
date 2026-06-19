import { prisma } from "@rag-local/db";

export async function cmdEject(dataset: string): Promise<void> {
  console.log(`[eject] dataset=${dataset}`);
  const { count } = await prisma.document.deleteMany({
    where: { beirSource: dataset },
  });
  console.log(`[eject] removed ${count} documents (chunks cascade).`);
  await prisma.$disconnect();
}
