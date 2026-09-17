import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationActionDto } from './notification-action.dto';

export class NotificationDetailResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  title: string;

  @ApiProperty()
  contentHtml: string;

  @ApiPropertyOptional()
  imageUrl?: string;

  @ApiPropertyOptional({ type: [NotificationActionDto] })
  actions?: NotificationActionDto[] | null;

  @ApiProperty()
  isRead: boolean;

  @ApiProperty()
  createdAt: Date;
}
