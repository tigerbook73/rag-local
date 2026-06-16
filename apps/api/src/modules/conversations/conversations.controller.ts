import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ConversationsService } from "./conversations.service.js";
import { UpdateConversationDto } from "./dto/update-conversation.dto.js";

@ApiTags("conversations")
@Controller("conversations")
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Post()
  create() {
    return this.conversationsService.create();
  }

  @Get()
  findAll() {
    return this.conversationsService.findAll();
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateConversationDto) {
    return this.conversationsService.update(id, dto);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(@Param("id") id: string) {
    return this.conversationsService.remove(id);
  }
}
