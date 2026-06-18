import { ApiProperty } from "@nestjs/swagger";

export class DocumentResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  filename!: string;

  @ApiProperty({ enum: ["txt", "md"] })
  fileType!: "txt" | "md";

  @ApiProperty({ enum: ["pending", "processing", "done", "failed"] })
  status!: "pending" | "processing" | "done" | "failed";

  @ApiProperty({ type: String, required: false, nullable: true })
  errorMessage?: string | null;

  @ApiProperty({ enum: ["fixed", "semantic"] })
  chunkingStrategy!: "fixed" | "semantic";

  @ApiProperty()
  chunkSize!: number;

  @ApiProperty()
  chunkOverlap!: number;

  @ApiProperty({ type: Number, required: false, nullable: true })
  totalChunks?: number | null;

  @ApiProperty({ type: Number, required: false, nullable: true })
  processedChunks?: number | null;

  @ApiProperty({ type: String, required: false, nullable: true })
  processingCompletedAt?: string | null;

  @ApiProperty()
  createdAt!: string;
}

export class DocumentListResponseDto {
  @ApiProperty({ type: () => [DocumentResponseDto] })
  data!: DocumentResponseDto[];
}

export class UploadDocumentResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  filename!: string;

  @ApiProperty({ enum: ["pending", "processing", "done", "failed"] })
  status!: "pending" | "processing" | "done" | "failed";
}

export class RetryDocumentResponseDto {
  @ApiProperty({ enum: ["pending"] })
  status!: "pending";
}
