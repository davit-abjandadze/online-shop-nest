import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { OtpService } from './otp.service';
import { EmailOtpService } from './email-otp.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { SendOtpResponseDto } from './dto/send-otp-response.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { SendEmailOtpDto } from './dto/send-email-otp.dto';
import { VerifyEmailOtpDto } from './dto/verify-email-otp.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

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
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 მოთხოვნა წუთში — verify.ge-ის ბილინგადი SMS-ის spam-ისგან დასაცავად
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
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 მოთხოვნა წუთში — კოდის brute-force-ისგან დასაცავად
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'OTP კოდის დადასტურება' })
  @ApiResponse({ status: 200, description: 'შედეგი: verified true/false' })
  async verifyOtp(@Body() dto: VerifyOtpDto): Promise<{ verified: boolean }> {
    const verified = await this.otpService.verifyOtp(dto.requestId, dto.code);
    return { verified };
  }

  // JwtAuthGuard: ეს ნაკადი მხოლოდ პროფილში ელფოსტის შეცვლისთვისაა (რეგისტრაცია
  // ელფოსტას არ ამოწმებს). public-ად ყოფნისას ნებისმიერს შეეძლო სხვის ელფოსტაზე
  // კოდების სპამი და 5 არასწორი კოდით ამ ელფოსტის 15 წუთით დაბლოკვა.
  @Post('send-email')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 მოთხოვნა წუთში — email-spam-ისგან დასაცავად
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 მოთხოვნა წუთში — კოდის brute-force-ისგან დასაცავად
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
