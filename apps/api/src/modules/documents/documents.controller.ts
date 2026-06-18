import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from "@nestjs/swagger";
import { DocumentsService } from "./documents.service.js";
import { UploadDocumentDto } from "./dto/upload-document.dto.js";
import {
  DocumentListResponseDto,
  DocumentResponseDto,
  RetryDocumentResponseDto,
  UploadDocumentResponseDto,
} from "./dto/document-response.dto.js";

@ApiTags("documents")
@Controller("documents")
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  @ApiConsumes("multipart/form-data")
  @ApiBody({ type: UploadDocumentDto })
  @ApiCreatedResponse({ type: UploadDocumentResponseDto })
  @UseInterceptors(FileInterceptor("file"))
  upload(@UploadedFile() file: Express.Multer.File) {
    return this.documentsService.upload(file);
  }

  @Get()
  @ApiOkResponse({ type: DocumentListResponseDto })
  findAll() {
    return this.documentsService.findAll();
  }

  @Get(":id")
  @ApiOkResponse({ type: DocumentResponseDto })
  findOne(@Param("id") id: string) {
    return this.documentsService.findOne(id);
  }

  @Delete(":id")
  @HttpCode(204)
  @ApiNoContentResponse()
  remove(@Param("id") id: string) {
    return this.documentsService.remove(id);
  }

  @Post(":id/retry")
  @ApiCreatedResponse({ type: RetryDocumentResponseDto })
  retry(@Param("id") id: string) {
    return this.documentsService.retry(id);
  }
}
