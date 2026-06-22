import { ApiProperty } from "@nestjs/swagger";

export class AppSettingsResponseDto {
  @ApiProperty({ enum: ["openai", "deepseek"] })
  llmProvider!: "openai" | "deepseek";

  @ApiProperty({ enum: ["fixed", "semantic"] })
  chunkingStrategy!: "fixed" | "semantic";

  @ApiProperty()
  chunkSize!: number;

  @ApiProperty()
  chunkOverlap!: number;

  @ApiProperty()
  hydeEnabled!: boolean;

  @ApiProperty()
  rerankingEnabled!: boolean;

  @ApiProperty()
  topK!: number;

  @ApiProperty()
  rerankTopK!: number;

  @ApiProperty()
  onlineEvaluationEnabled!: boolean;

  @ApiProperty()
  conversationHistoryWindow!: number;

  @ApiProperty({ enum: ["dense", "bm25", "hybrid"] })
  retrievalMode!: "dense" | "bm25" | "hybrid";

  @ApiProperty({ required: false, enum: [true] })
  requiresReindex?: true;
}
