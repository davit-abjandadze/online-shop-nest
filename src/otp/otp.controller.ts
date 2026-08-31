import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { OtpService } from './otp.service';
import { EmailOtpService } from './email-otp.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { SendOtpResponseDto } from './dto/send-otp-response.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { SendEmailOtpDto } from './dto/send-email-otp.dto';
import { VerifyEmailOtpDto } from './dto/verify-email-otp.dto';

// მობილურის ნომრის SMS-ვერიფიკაციის endpoint-ები (verify.ge ინტეგრაცია).
// გამოიყენება რეგისტრაციის წინ: 1) POST /otp/send, 2) POST /otp/verify,
// მიღებული requestId + code შემდეგ /auth/register-ს გადაეცემა.
//
// ელფოსტის ვერიფიკაციის endpoint-ები (POST /otp/send-email, POST /otp/verify-email) —
// გამოიყენება, მაგ., პროფილში ელფოსტის შეცვლის წინ, საკუთარი (verify.ge-ის გარეშე) OTP-ით.
@ApiTags('otp')
@Controller('otp')
export class OtpController {
  constructor(
    private readonly otpService: OtpService,
    private readonly emailOtpService: EmailOtpService,
  ) {}

  @Post('send')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'OTP კოდის გაგზავნა მითითებულ მობილურზე' })
  @ApiResponse({
    status: 200,
    description: 'კოდი გაიგზავნა',
    type: SendOtpResponseDto,
  })
  @ApiResponse({ status: 400, description: 'გაგზავნა ვერ მოხერხდა' })
  sendOtp(@Body() dto: SendOtpDto): Promise<SendOtpResponseDto> {
    return this.otpService.sendOtp(dto.phoneNumber);
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'OTP კოდის დადასტურება' })
  @ApiResponse({ status: 200, description: 'შედეგი: verified true/false' })
  async verifyOtp(@Body() dto: VerifyOtpDto): Promise<{ verified: boolean }> {
    const verified = await this.otpService.verifyOtp(dto.requestId, dto.code);
    return { verified };
  }

  @Post('send-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'OTP კოდის გაგზავნა მითითებულ ელფოსტაზე' })
  @ApiResponse({
    status: 200,
    description: 'კოდი გაიგზავნა',
    type: SendOtpResponseDto,
  })
  @ApiResponse({ status: 400, description: 'გაგზავნა ვერ მოხერხდა' })
  sendEmailOtp(@Body() dto: SendEmailOtpDto): Promise<SendOtpResponseDto> {
    return this.emailOtpService.sendOtp(dto.email);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'ელფოსტაზე გაგზავნილი OTP კოდის დადასტურება' })
  @ApiResponse({ status: 200, description: 'შედეგი: verified true/false' })
  verifyEmailOtp(
    @Body() dto: VerifyEmailOtpDto,
  ): Promise<{ verified: boolean }> {
    const verified = this.emailOtpService.verifyOtp(dto.requestId, dto.code);
    return Promise.resolve({ verified });
  }
}
