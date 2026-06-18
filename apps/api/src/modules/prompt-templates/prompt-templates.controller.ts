import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from "@nestjs/common";
import { ApiNoContentResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { PromptTemplatesService } from "./prompt-templates.service.js";
import { CreatePromptTemplateDto } from "./dto/create-prompt-template.dto.js";
import { UpdatePromptTemplateDto } from "./dto/update-prompt-template.dto.js";
import {
  PromptTemplateListResponseDto,
  PromptTemplateResponseDto,
} from "./dto/prompt-template-response.dto.js";

@ApiTags("prompt-templates")
@Controller("prompt-templates")
export class PromptTemplatesController {
  constructor(private readonly promptTemplatesService: PromptTemplatesService) {}

  @Get()
  @ApiOkResponse({ type: PromptTemplateListResponseDto })
  findAll() {
    return this.promptTemplatesService.findAll();
  }

  @Post()
  @ApiOkResponse({ type: PromptTemplateResponseDto })
  create(@Body() dto: CreatePromptTemplateDto) {
    return this.promptTemplatesService.create(dto);
  }

  @Patch(":id")
  @ApiOkResponse({ type: PromptTemplateResponseDto })
  update(@Param("id") id: string, @Body() dto: UpdatePromptTemplateDto) {
    return this.promptTemplatesService.update(id, dto);
  }

  @Delete(":id")
  @HttpCode(204)
  @ApiNoContentResponse()
  remove(@Param("id") id: string) {
    return this.promptTemplatesService.remove(id);
  }
}
