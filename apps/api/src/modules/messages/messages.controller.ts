import { Body, Controller, Get, HttpCode, Param, Patch, Post, Res } from "@nestjs/common";
import type { Response } from "express";
import { ApiNoContentResponse, ApiOkResponse, ApiProduces, ApiTags } from "@nestjs/swagger";
import { MessagesService } from "./messages.service.js";
import { SendMessageDto } from "./dto/send-message.dto.js";
import { UpdateFeedbackDto } from "./dto/update-feedback.dto.js";
import { EvaluationResponseDto, MessageListResponseDto } from "./dto/message-response.dto.js";

@ApiTags("messages")
@Controller()
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get("conversations/:id/messages")
  @ApiOkResponse({ type: MessageListResponseDto })
  findAll(@Param("id") conversationId: string) {
    return this.messagesService.findAll(conversationId);
  }

  @Post("conversations/:id/messages")
  @HttpCode(200)
  @ApiProduces("text/event-stream")
  async sendMessage(
    @Param("id") conversationId: string,
    @Body() dto: SendMessageDto,
    @Res() res: Response,
  ): Promise<void> {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    try {
      await this.messagesService.streamChat(conversationId, dto, res);
    } catch (err) {
      res.write(
        `event: error\ndata: ${JSON.stringify({ code: "STREAM_ERROR", message: String(err) })}\n\n`,
      );
    } finally {
      res.end();
    }
  }

  @Patch("messages/:id/feedback")
  @HttpCode(204)
  @ApiNoContentResponse()
  updateFeedback(@Param("id") id: string, @Body() dto: UpdateFeedbackDto) {
    return this.messagesService.updateFeedback(id, dto);
  }

  @Get("messages/:id/evaluation")
  @ApiOkResponse({ type: EvaluationResponseDto })
  getEvaluation(@Param("id") id: string) {
    return this.messagesService.getEvaluation(id);
  }
}
