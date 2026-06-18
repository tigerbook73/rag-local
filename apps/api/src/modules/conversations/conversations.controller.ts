import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Logger,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { ConversationsService } from "./conversations.service.js";
import { UpdateConversationDto } from "./dto/update-conversation.dto.js";
import {
  ConversationCreateResponseDto,
  ConversationListResponseDto,
  ConversationUpdateResponseDto,
} from "./dto/conversation-response.dto.js";

@ApiTags("conversations")
@Controller("conversations")
export class ConversationsController {
  private readonly logger = new Logger(ConversationsController.name);

  constructor(private readonly conversationsService: ConversationsService) {}

  @Post()
  @ApiCreatedResponse({ type: ConversationCreateResponseDto })
  async create() {
    this.logger.log(`Creating conversation`);
    const result = await this.conversationsService.create();
    this.logger.log(`Created conversation ${result.id}`);
    return result;
  }

  @Get()
  @ApiOkResponse({ type: ConversationListResponseDto })
  findAll() {
    return this.conversationsService.findAll();
  }

  @Patch(":id")
  @ApiOkResponse({ type: ConversationUpdateResponseDto })
  async update(@Param("id") id: string, @Body() dto: UpdateConversationDto) {
    const result = await this.conversationsService.update(id, dto);
    this.logger.log(`Updated conversation ${id}`);
    return result;
  }

  @Delete(":id")
  @HttpCode(204)
  @ApiNoContentResponse()
  async remove(@Param("id") id: string) {
    await this.conversationsService.remove(id);
    this.logger.log(`Deleted conversation ${id}`);
  }
}
