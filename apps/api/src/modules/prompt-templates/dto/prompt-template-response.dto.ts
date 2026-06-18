import { ApiProperty } from "@nestjs/swagger";

export class PromptTemplateResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  content!: string;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class PromptTemplateListResponseDto {
  @ApiProperty({ type: [PromptTemplateResponseDto] })
  data!: PromptTemplateResponseDto[];
}
