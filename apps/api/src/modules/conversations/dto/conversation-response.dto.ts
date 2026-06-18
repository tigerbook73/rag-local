import { ApiProperty } from "@nestjs/swagger";

export class ConversationResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class ConversationCreateResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  createdAt!: string;
}

export class ConversationUpdateResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;
}

export class ConversationListResponseDto {
  @ApiProperty({ type: () => [ConversationResponseDto] })
  data!: ConversationResponseDto[];

  @ApiProperty()
  total!: number;
}
