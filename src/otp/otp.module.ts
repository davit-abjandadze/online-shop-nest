import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { OtpService } from './otp.service';
import { EmailOtpService } from './email-otp.service';
import { OtpController } from './otp.controller';
import { EmailService } from '../common/email/email.service';

@Module({
  imports: [HttpModule, ConfigModule],
  controllers: [OtpController],
  providers: [OtpService, EmailOtpService, EmailService],
  exports: [OtpService, EmailOtpService],
})
export class OtpModule {}
