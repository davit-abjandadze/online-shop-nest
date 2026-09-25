import { IsString, IsNotEmpty, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {
  GEORGIAN_MOBILE_REGEX,
  stripPhoneSeparators,
} from '../../common/utils/phone.util';

// OTP კოდის მოთხოვნა მითითებულ მობილურის ნომერზე (registration/verification ნაკადის 1-ლი ნაბიჯი).
export class SendOtpDto {
  @ApiProperty({
    description: 'მობილურის ნომერი, სადაც გაიგზავნება კოდი',
    example: '+995599123456',
  })
  @Transform(({ value }: { value: unknown }) => stripPhoneSeparators(value))
  @IsString()
  @IsNotEmpty({ message: 'ტელეფონის ნომერი სავალდებულოა' })
  @Matches(GEORGIAN_MOBILE_REGEX, {
    message: 'მიუთითეთ ვალიდური ქართული მობილურის ნომერი (5XXXXXXXX)',
  })
  phoneNumber: string;
}
