import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationActionDto } from './notification-action.dto';

export class UpdateNotificationDto {
  @ApiPropertyOptional({
    description: 'შეტყობინების სათაური',
    example: 'ახალი ფასდაკლება',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @ApiPropertyOptional({
    description:
      'rich-text ედიტორის (TipTap/Quill) HTML output — შენახვამდე ავტომატურად sanitize-დება',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  contentHtml?: string;

  @ApiPropertyOptional({
    description:
      'ატვირთული სურათის URL (POST /admin/notifications/upload-image-დან)',
  })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({
    description: 'მოდალის ღილაკები (მაგ. "დახურვა" და "პროდუქტის ნახვა")',
    type: [NotificationActionDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NotificationActionDto)
  actions?: NotificationActionDto[];
}
