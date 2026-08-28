import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// OTP კოდის მოთხოვნა მითითებულ მობილურის ნომერზე (registration/verification ნაკადის 1-ლი ნაბიჯი).
export class SendOtpDto {
  @ApiProperty({ description: 'მობილურის ნომერი, სადაც გაიგზავნება კოდი' })
  @IsString()
  @IsNotEmpty({ message: 'ტელეფონის ნომერი სავალდებულოა' })
  phoneNumber: string;
}
