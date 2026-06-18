import { ApiProperty } from "@nestjs/swagger";

export class AppSettingsResponseDto {
  @ApiProperty({ enum: ["openai", "deepseek"] })
  llmProvider!: "openai" | "deepseek";

  @ApiProperty()
  llmModel!: string;

  @ApiProperty({ type: String, nullable: true })
  llmBaseUrl!: string | null;

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
  onlineEvaluationEnabled!: boolean;

  @ApiProperty()
  conversationHistoryWindow!: number;

  @ApiProperty({ required: false, enum: [true] })
  requiresReindex?: true;
}
