import { IsIn } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class UpdateFeedbackDto {
  @ApiProperty({ enum: ["positive", "negative"] })
  @IsIn(["positive", "negative"])
  feedback!: "positive" | "negative";
}
