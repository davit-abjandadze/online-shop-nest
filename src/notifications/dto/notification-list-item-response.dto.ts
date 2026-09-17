import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NotificationListItemResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  title: string;

  @ApiProperty({
    description: 'contentHtml-ის ტეგებმოცილებული, შემოკლებული preview',
  })
  snippet: string;

  @ApiPropertyOptional()
  imageUrl?: string;

  @ApiProperty()
  isRead: boolean;

  @ApiProperty()
  createdAt: Date;
}
