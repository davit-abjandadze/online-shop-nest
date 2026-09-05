import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsStrongPassword } from '../../common/decorators/is-strong-password.decorator';

export class ChangePasswordDto {
  @ApiProperty({
    description: 'ძველი პაროლი',
    example: 'oldPassword123',
  })
  @IsString()
  @IsNotEmpty()
  oldPassword: string;

  @ApiProperty({
    description:
      'ახალი პაროლი (მინიმუმ 8 სიმბოლო, დიდი და პატარა ასო და ციფრი)',
    example: 'newPassword456',
  })
  @IsString()
  @IsStrongPassword()
  newPassword: string;
}
