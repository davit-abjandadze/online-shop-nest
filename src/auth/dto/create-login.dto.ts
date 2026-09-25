import { IsEmail, IsString, MinLength } from 'class-validator';
import { NormalizeEmail } from '../../common/decorators/normalize-email.decorator';

export class LoginDto {
  @NormalizeEmail()
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}
