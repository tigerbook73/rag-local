import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min } from "class-validator";

export class UpdateSettingsDto {
  @IsOptional()
  @IsIn(["openai", "deepseek"])
  llmProvider?: "openai" | "deepseek";

  @IsOptional()
  @IsString()
  llmModel?: string;

  @IsOptional()
  @IsString()
  llmBaseUrl?: string;

  @IsOptional()
  @IsIn(["fixed", "semantic"])
  chunkingStrategy?: "fixed" | "semantic";

  @IsOptional()
  @IsInt()
  @Min(64)
  chunkSize?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  chunkOverlap?: number;

  @IsOptional()
  @IsBoolean()
  hydeEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  rerankingEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  topK?: number;

  @IsOptional()
  @IsBoolean()
  onlineEvaluationEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  conversationHistoryWindow?: number;
}
