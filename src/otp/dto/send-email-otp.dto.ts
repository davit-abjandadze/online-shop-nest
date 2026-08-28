import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// ელფოსტაზე OTP კოდის მოთხოვნა (მაგ. პროფილში ელფოსტის შეცვლის წინ დასადასტურებლად).
export class SendEmailOtpDto {
  @ApiProperty({ description: 'ელფოსტა, სადაც გაიგზავნება დადასტურების კოდი' })
  @IsEmail({}, { message: 'გთხოვთ მიუთითოთ ვალიდური ელფოსტა' })
  @IsNotEmpty({ message: 'ელფოსტა სავალდებულოა' })
  email: string;
}
