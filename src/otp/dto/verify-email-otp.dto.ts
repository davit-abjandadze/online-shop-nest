import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// ელფოსტაზე გაგზავნილი OTP კოდის დადასტურება — send-email-ისგან მიღებული requestId
// + მომხმარებლის მიერ შეყვანილი კოდი.
export class VerifyEmailOtpDto {
  @ApiProperty({ description: 'send-email-ის პასუხიდან მიღებული requestId' })
  @IsString()
  @IsNotEmpty()
  requestId: string;

  @ApiProperty({ description: 'მომხმარებლის ელფოსტაზე მიღებული კოდი' })
  @IsString()
  @IsNotEmpty({ message: 'OTP კოდი სავალდებულოა' })
  code: string;
}
