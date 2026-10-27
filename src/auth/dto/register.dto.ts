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
import { Transform } from 'class-transformer';
import {
  GEORGIAN_MOBILE_REGEX,
  stripPhoneSeparators,
} from '../../common/utils/phone.util';
import { Gender } from '../../users/entities/user.entity';
import { NormalizeEmail } from '../../common/decorators/normalize-email.decorator';
import { IsStrongPassword } from '../../common/decorators/is-strong-password.decorator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @NormalizeEmail()
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

  // იგივე წესი, რაც POST /otp/send-ზე (SendOtpDto) — ფორმატის გარეშე
  // ნებისმიერი სტრიქონი ნორმალიზაციისას (hashPhoneForSearch) ცარიელ ან
  // შემთხვევით ციფრებად იქცეოდა.
  @Transform(({ value }: { value: unknown }) => stripPhoneSeparators(value))
  @IsString()
  @IsNotEmpty({ message: 'ტელეფონის ნომერი სავალდებულოა' })
  @Matches(GEORGIAN_MOBILE_REGEX, {
    message: 'მიუთითეთ ვალიდური ქართული მობილურის ნომერი (5XXXXXXXX)',
  })
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
