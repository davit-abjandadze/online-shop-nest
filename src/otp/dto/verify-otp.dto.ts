import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// OTP კოდის დადასტურება — send-otp-ისგან მიღებული requestId + მომხმარებლის მიერ შეყვანილი კოდი.
export class VerifyOtpDto {
  @ApiProperty({ description: 'send-otp-ის პასუხიდან მიღებული requestId' })
  @IsString()
  @IsNotEmpty()
  requestId: string;

  @ApiProperty({ description: 'მომხმარებლის მობილურზე მიღებული კოდი' })
  @IsString()
  @IsNotEmpty({ message: 'OTP კოდი სავალდებულოა' })
  code: string;
}
