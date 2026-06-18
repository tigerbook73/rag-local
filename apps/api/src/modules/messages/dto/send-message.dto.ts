import { IsString, MinLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class SendMessageDto {
  @ApiProperty({ minLength: 1 })
  @IsString()
  @MinLength(1)
  content!: string;
}
