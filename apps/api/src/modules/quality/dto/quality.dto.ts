import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Min } from "class-validator";

export class EvaluationListQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  conversationId?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number = 20;
}

export class BeirRunListQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dataset?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number = 20;
}

export class EvaluationMetricDto {
  @ApiProperty({ enum: ["faithfulness", "answer_relevancy", "context_precision"] })
  metric!: "faithfulness" | "answer_relevancy" | "context_precision";

  @ApiProperty()
  score!: number;

  @ApiProperty({ type: String, nullable: true })
  reason!: string | null;
}

export class EvaluationSummaryDto {
  @ApiProperty()
  messageId!: string;

  @ApiProperty()
  conversationId!: string;

  @ApiPropertyOptional()
  conversationTitle?: string;

  @ApiPropertyOptional()
  question?: string;

  @ApiProperty({ type: () => [EvaluationMetricDto] })
  evaluations!: EvaluationMetricDto[];

  @ApiProperty()
  createdAt!: string;
}

export class EvaluationListResponseDto {
  @ApiProperty({ type: () => [EvaluationSummaryDto] })
  data!: EvaluationSummaryDto[];

  @ApiProperty()
  total!: number;
}

export class BeirMetricsDto {
  @ApiProperty()
  ndcg10!: number;

  @ApiProperty()
  recall10!: number;

  @ApiProperty()
  recall100!: number;

  @ApiProperty()
  mrr10!: number;
}

export class BeirEvalRunSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  dataset!: string;

  @ApiProperty()
  embeddingConfig!: string;

  @ApiProperty()
  sampleSize!: number;

  @ApiProperty({ type: () => BeirMetricsDto })
  metrics!: BeirMetricsDto;

  @ApiProperty()
  createdAt!: string;
}

export class BeirRunListResponseDto {
  @ApiProperty({ type: () => [BeirEvalRunSummaryDto] })
  data!: BeirEvalRunSummaryDto[];

  @ApiProperty()
  total!: number;
}

export class BeirHitDto {
  @ApiProperty()
  docId!: string;

  @ApiProperty()
  score!: number;
}

export class BeirQueryDetailDto {
  @ApiProperty()
  queryId!: string;

  @ApiProperty()
  queryText!: string;

  @ApiProperty({ type: () => [BeirHitDto] })
  hits!: BeirHitDto[];

  @ApiProperty()
  relevantInTop10!: number;

  @ApiProperty()
  ndcg10!: number;
}

export class BeirEvalRunDetailDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  dataset!: string;

  @ApiProperty()
  embeddingConfig!: string;

  @ApiProperty()
  sampleSize!: number;

  @ApiProperty({ type: () => BeirMetricsDto })
  metrics!: BeirMetricsDto;

  @ApiProperty({ type: () => [BeirQueryDetailDto] })
  details!: BeirQueryDetailDto[];

  @ApiProperty()
  createdAt!: string;
}

export class BeirSampleQueryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  dataset!: string;

  @ApiProperty()
  text!: string;
}

export class BeirSampleQueriesResponseDto {
  @ApiProperty({ type: () => [BeirSampleQueryDto] })
  data!: BeirSampleQueryDto[];
}
