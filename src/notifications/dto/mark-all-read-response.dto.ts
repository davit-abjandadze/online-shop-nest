import { ApiProperty } from '@nestjs/swagger';

export class MarkAllReadResponseDto {
  @ApiProperty({ description: 'რამდენი recipient-row მოინიშნა წაკითხულად' })
  updated: number;
}
