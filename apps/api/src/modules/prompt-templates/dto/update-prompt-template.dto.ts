import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdatePromptTemplateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  content?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
