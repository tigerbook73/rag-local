import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { LoggerModule } from "nestjs-pino";
import { PrismaModule } from "./common/prisma.module.js";
import { SupabaseModule } from "./common/supabase.module.js";
import { HealthController } from "./modules/health/health.controller.js";
import { HealthService } from "./modules/health/health.service.js";
import { DocumentsModule } from "./modules/documents/documents.module.js";
import { ConversationsModule } from "./modules/conversations/conversations.module.js";
import { MessagesModule } from "./modules/messages/messages.module.js";
import { SettingsModule } from "./modules/settings/settings.module.js";

const { hostname: redisHost, port: redisPortStr } = new URL(
  process.env["REDIS_URL"] ?? "redis://localhost:6379",
);

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env["NODE_ENV"] !== "production"
            ? { target: "pino-pretty", options: { colorize: true } }
            : undefined,
      },
    }),
    BullModule.forRoot({
      connection: { host: redisHost, port: Number(redisPortStr || 6379) },
    }),
    PrismaModule,
    SupabaseModule,
    SettingsModule,
    DocumentsModule,
    ConversationsModule,
    MessagesModule,
  ],
  controllers: [HealthController],
  providers: [HealthService],
})
export class AppModule {}
