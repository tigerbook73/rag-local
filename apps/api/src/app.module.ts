import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { LoggerModule } from "nestjs-pino";
import { parseRedisUrl, getRedisKeyPrefix } from "@rag-local/core";
import { PrismaModule } from "./common/prisma.module.js";
import { SupabaseModule } from "./common/supabase.module.js";
import { HealthController } from "./modules/health/health.controller.js";
import { HealthService } from "./modules/health/health.service.js";
import { DocumentsModule } from "./modules/documents/documents.module.js";
import { ConversationsModule } from "./modules/conversations/conversations.module.js";
import { MessagesModule } from "./modules/messages/messages.module.js";
import { SettingsModule } from "./modules/settings/settings.module.js";
import { PromptTemplatesModule } from "./modules/prompt-templates/prompt-templates.module.js";

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
    BullModule.forRoot({ connection: parseRedisUrl(), prefix: getRedisKeyPrefix() || undefined }),
    PrismaModule,
    SupabaseModule,
    SettingsModule,
    DocumentsModule,
    ConversationsModule,
    MessagesModule,
    PromptTemplatesModule,
  ],
  controllers: [HealthController],
  providers: [HealthService],
})
export class AppModule {}
