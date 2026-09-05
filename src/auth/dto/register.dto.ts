import {
  IsEmail,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  Matches,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Gender } from '../../users/entities/user.entity';
import { IsStrongPassword } from '../../common/decorators/is-strong-password.decorator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsStrongPassword()
  password: string;

  @ApiPropertyOptional({ enum: Gender, description: 'მომხმარებლის სქესი' })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({ description: 'მომხმარებლის ასაკი' })
  @IsOptional()
  @IsInt()
  @Min(0)
  age?: number;

  @ApiPropertyOptional({
    description: 'პირადი ნომერი — ზუსტად 11 ციფრი',
    example: '01234567890',
  })
  @IsOptional()
  @Matches(/^\d{11}$/, {
    message: 'პირადი ნომერი უნდა შეიცავდეს ზუსტად 11 ციფრს',
  })
  personalNumber?: string;

  @IsString()
  @IsNotEmpty({ message: 'ტელეფონის ნომერი სავალდებულოა' })
  phoneNumber!: string;

  @ApiPropertyOptional({
    description:
      'POST /otp/send-ის პასუხიდან მიღებული requestId — თუ SMS ვერიფიკაცია ჩართულია, ' +
      'სავალდებულოა otpCode-თან ერთად',
  })
  @IsOptional()
  @IsString()
  otpRequestId?: string;

  @ApiPropertyOptional({
    description: 'მომხმარებლის მობილურზე მიღებული OTP კოდი',
  })
  @IsOptional()
  @IsString()
  otpCode?: string;
}
