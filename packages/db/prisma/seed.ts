import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_SETTINGS: Record<string, string> = {
  llm_provider: "deepseek",
  chunking_strategy: "fixed",
  chunk_size: "512",
  chunk_overlap: "50",
  hyde_enabled: "false",
  reranking_enabled: "false",
  top_k: "5",
  online_evaluation_enabled: "false",
  conversation_history_window: "50",
};

async function main() {
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await prisma.setting.upsert({
      where: { key },
      create: { key, value },
      update: {},
    });
  }
  console.log("Seed: settings defaults upserted");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
