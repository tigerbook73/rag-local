import { IsIn } from "class-validator";

export class UpdateFeedbackDto {
  @IsIn(["positive", "negative"])
  feedback!: "positive" | "negative";
}
