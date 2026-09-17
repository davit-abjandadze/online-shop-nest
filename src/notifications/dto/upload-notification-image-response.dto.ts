import { ApiProperty } from '@nestjs/swagger';

export class UploadNotificationImageResponseDto {
  @ApiProperty({
    description:
      'ატვირთული სურათის საჯარო URL — ედიტორი embed-ავს content HTML-ში',
    example: 'http://localhost:5000/uploads/notifications/abc123.png',
  })
  url: string;
}
