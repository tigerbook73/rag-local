import { Module } from "@nestjs/common";
import { PromptTemplatesController } from "./prompt-templates.controller.js";
import { PromptTemplatesService } from "./prompt-templates.service.js";

@Module({
  controllers: [PromptTemplatesController],
  providers: [PromptTemplatesService],
})
export class PromptTemplatesModule {}
