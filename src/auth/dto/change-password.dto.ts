import { IsString, MinLength, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({
    description: 'ძველი პაროლი',
    example: 'oldPassword123',
  })
  @IsString()
  @IsNotEmpty()
  oldPassword: string;

  @ApiProperty({
    description: 'ახალი პაროლი (მინიმუმ 6 სიმბოლო)',
    example: 'newPassword456',
  })
  @IsString()
  @MinLength(6, { message: 'ახალი პაროლი უნდა იყოს მინიმუმ 6 სიმბოლო' })
  newPassword: string;
}
