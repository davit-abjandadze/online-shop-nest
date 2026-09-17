import { ApiProperty } from '@nestjs/swagger';

export class UnreadCountResponseDto {
  @ApiProperty({ description: 'წაუკითხავი შეტყობინებების რაოდენობა' })
  count: number;
}
