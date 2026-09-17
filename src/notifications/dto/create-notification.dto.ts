import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsInt,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationActionDto } from './notification-action.dto';

export class CreateNotificationDto {
  @ApiProperty({
    description: 'შეტყობინების სათაური',
    example: 'ახალი ფასდაკლება',
  })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({
    description:
      'rich-text ედიტორის (TipTap/Quill) HTML output — შენახვამდე ავტომატურად sanitize-დება',
  })
  @IsString()
  @IsNotEmpty()
  contentHtml!: string;

  @ApiPropertyOptional({
    description:
      'ატვირთული სურათის URL (POST /admin/notifications/upload-image-დან)',
  })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({
    description:
      'კონკრეტული მიმღები user-ების ID-ები — თუ არ მიეთითება, შეტყობინება ეგზავნება ყველა user-ს',
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  targetUserIds?: number[];

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
