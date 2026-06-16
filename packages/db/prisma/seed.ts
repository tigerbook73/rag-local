import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
  console.log("Seed: settings default row created");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
