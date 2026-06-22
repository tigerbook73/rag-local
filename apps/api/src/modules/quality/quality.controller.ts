import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiOkResponse, ApiQuery, ApiTags } from "@nestjs/swagger";
import { QualityService } from "./quality.service.js";
import {
  BeirEvalRunDetailDto,
  BeirRunListQueryDto,
  BeirRunListResponseDto,
  BeirSampleQueriesResponseDto,
  EvaluationListQueryDto,
  EvaluationListResponseDto,
} from "./dto/quality.dto.js";

@ApiTags("quality")
@Controller("quality")
export class QualityController {
  constructor(private readonly qualityService: QualityService) {}

  @Get("evaluations")
  @ApiOkResponse({ type: EvaluationListResponseDto })
  listEvaluations(@Query() query: EvaluationListQueryDto) {
    return this.qualityService.listEvaluations(query);
  }

  @Get("beir-sample-queries")
  @ApiOkResponse({ type: BeirSampleQueriesResponseDto })
  @ApiQuery({ name: "count", required: false, type: Number })
  sampleBeirQueries(@Query("count") count?: string) {
    const n = Math.min(Math.max(parseInt(count ?? "8", 10) || 8, 5), 10);
    return this.qualityService.sampleBeirQueries(n);
  }

  @Get("beir-runs")
  @ApiOkResponse({ type: BeirRunListResponseDto })
  listBeirRuns(@Query() query: BeirRunListQueryDto) {
    return this.qualityService.listBeirRuns(query);
  }

  @Get("beir-runs/:id")
  @ApiOkResponse({ type: BeirEvalRunDetailDto })
  getBeirRunDetail(@Param("id") id: string) {
    return this.qualityService.getBeirRunDetail(id);
  }
}
