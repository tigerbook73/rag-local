import { IsBoolean, IsIn, IsInt, IsOptional, Min } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateSettingsDto {
  @ApiPropertyOptional({ enum: ["openai", "deepseek"] })
  @IsOptional()
  @IsIn(["openai", "deepseek"])
  llmProvider?: "openai" | "deepseek";

  @ApiPropertyOptional({ enum: ["fixed", "semantic"] })
  @IsOptional()
  @IsIn(["fixed", "semantic"])
  chunkingStrategy?: "fixed" | "semantic";

  @ApiPropertyOptional({ minimum: 64 })
  @IsOptional()
  @IsInt()
  @Min(64)
  chunkSize?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  chunkOverlap?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hydeEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  rerankingEnabled?: boolean;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  topK?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  onlineEvaluationEnabled?: boolean;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  conversationHistoryWindow?: number;

  @ApiPropertyOptional({ enum: ["dense", "bm25", "hybrid"] })
  @IsOptional()
  @IsIn(["dense", "bm25", "hybrid"])
  retrievalMode?: "dense" | "bm25" | "hybrid";
}
