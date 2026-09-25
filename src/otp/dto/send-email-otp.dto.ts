import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { NormalizeEmail } from '../../common/decorators/normalize-email.decorator';

// ელფოსტაზე OTP კოდის მოთხოვნა (მაგ. პროფილში ელფოსტის შეცვლის წინ დასადასტურებლად).
export class SendEmailOtpDto {
  @ApiProperty({ description: 'ელფოსტა, სადაც გაიგზავნება დადასტურების კოდი' })
  @NormalizeEmail()
  @IsEmail({}, { message: 'გთხოვთ მიუთითოთ ვალიდური ელფოსტა' })
  @IsNotEmpty({ message: 'ელფოსტა სავალდებულოა' })
  email: string;
}
