import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordResponseDto {
  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: 'პაროლი წარმატებით შეიცვალა' })
  message: string;
}
