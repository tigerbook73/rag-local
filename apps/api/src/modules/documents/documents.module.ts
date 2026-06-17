import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { QUEUE_NAMES } from "@rag-local/core";
import { DocumentsController } from "./documents.controller.js";
import { DocumentsService } from "./documents.service.js";
import { SettingsModule } from "../settings/settings.module.js";

@Module({
  imports: [BullModule.registerQueue({ name: QUEUE_NAMES.EMBEDDING }), SettingsModule],
  controllers: [DocumentsController],
  providers: [DocumentsService],
})
export class DocumentsModule {}
