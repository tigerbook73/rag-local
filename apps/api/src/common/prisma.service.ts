import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@rag-local/db";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  // Prisma v5+ connects lazily — no eager $connect() to keep --spec mode DB-free
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
