import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationActionDto } from './notification-action.dto';

export class NotificationResponseDto {
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

  @ApiPropertyOptional({
    description: 'ავტორი admin-ის ID — null, თუ ავტორის ანგარიში წაშლილია',
    nullable: true,
  })
  createdByUserId?: number | null;

  @ApiProperty()
  createdAt: Date;
}
