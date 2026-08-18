import { IsString, IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Token, რომელიც მიღებულია email-იდან' })
  @IsString()
  @IsNotEmpty({ message: 'Token სავალდებულოა' })
  token!: string;

  @ApiProperty({ description: 'ახალი პაროლი', example: 'newPassword123' })
  @IsString()
  @IsNotEmpty({ message: 'პაროლი სავალდებულოა' })
  @MinLength(6, { message: 'პაროლი უნდა იყოს მინიმუმ 6 სიმბოლო' })
  newPassword!: string;
}
