import { ApiProperty } from "@nestjs/swagger";

export class RetrievedChunkResponseDto {
  @ApiProperty()
  chunkId!: string;

  @ApiProperty()
  documentId!: string;

  @ApiProperty()
  documentName!: string;

  @ApiProperty()
  content!: string;

  @ApiProperty()
  similarityScore!: number;

  @ApiProperty({ required: false })
  rerankScore?: number;
}

export class MessageResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  conversationId!: string;

  @ApiProperty({ enum: ["user", "assistant"] })
  role!: "user" | "assistant";

  @ApiProperty()
  content!: string;

  @ApiProperty({ enum: ["positive", "negative"], required: false, nullable: true })
  feedback?: "positive" | "negative" | null;

  @ApiProperty({ type: () => [RetrievedChunkResponseDto], required: false, nullable: true })
  retrievedChunks?: RetrievedChunkResponseDto[] | null;

  @ApiProperty({ type: Number, required: false, nullable: true })
  ttftMs?: number | null;

  @ApiProperty({ type: Number, required: false, nullable: true })
  totalMs?: number | null;

  @ApiProperty({ type: Number, required: false, nullable: true })
  retrievalMs?: number | null;

  @ApiProperty()
  createdAt!: string;
}

export class MessageListResponseDto {
  @ApiProperty({ type: () => [MessageResponseDto] })
  data!: MessageResponseDto[];
}

export class EvaluationItemResponseDto {
  @ApiProperty({ enum: ["faithfulness", "answer_relevancy", "context_precision"] })
  metric!: "faithfulness" | "answer_relevancy" | "context_precision";

  @ApiProperty()
  score!: number;

  @ApiProperty({ type: String, nullable: true })
  reason!: string | null;
}

export class EvaluationResponseDto {
  @ApiProperty({ enum: ["pending", "completed"] })
  status!: "pending" | "completed";

  @ApiProperty({ type: () => [EvaluationItemResponseDto], required: false })
  evaluations?: EvaluationItemResponseDto[];
}
