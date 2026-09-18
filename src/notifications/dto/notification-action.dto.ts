import {
  IsEnum,
  IsNotEmpty,
  IsString,
  IsUrl,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// მოდალის ღილაკები — "close" უბრალოდ მოდალს ხურავს (url არ სჭირდება),
// "link" კი კონკრეტულ URL-ზე გადადის ახალ tab-ში (rel="noopener noreferrer").
export enum NotificationActionType {
  CLOSE = 'close',
  LINK = 'link',
}

export interface NotificationAction {
  label: string;
  type: NotificationActionType;
  url?: string;
}

export class NotificationActionDto implements NotificationAction {
  @ApiProperty({ description: 'ღილაკზე გამოსახული ტექსტი', example: 'დახურვა' })
  @IsString()
  @IsNotEmpty()
  label!: string;

  @ApiProperty({
    enum: NotificationActionType,
    description: 'close — მხოლოდ მოდალს ხურავს; link — გადადის url-ზე',
  })
  @IsEnum(NotificationActionType)
  type!: NotificationActionType;

  @ApiPropertyOptional({
    description: 'type=link-ის შემთხვევაში სავალდებულო, http(s) URL',
  })
  @ValidateIf(
    (action: NotificationActionDto) =>
      action.type === NotificationActionType.LINK,
  )
  @IsString()
  @IsNotEmpty()
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  url?: string;
}
