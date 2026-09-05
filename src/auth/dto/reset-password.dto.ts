import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsStrongPassword } from '../../common/decorators/is-strong-password.decorator';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Token, რომელიც მიღებულია email-იდან' })
  @IsString()
  @IsNotEmpty({ message: 'Token სავალდებულოა' })
  token!: string;

  @ApiProperty({ description: 'ახალი პაროლი', example: 'newPassword123' })
  @IsString()
  @IsNotEmpty({ message: 'პაროლი სავალდებულოა' })
  @IsStrongPassword()
  newPassword!: string;
}
