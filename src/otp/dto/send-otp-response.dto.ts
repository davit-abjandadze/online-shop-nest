import { ApiProperty } from '@nestjs/swagger';

// send-otp-ის პასუხი — requestId საჭიროა შემდეგ ნაბიჯზე (verify-otp/register) გადასაცემად.
export class SendOtpResponseDto {
  @ApiProperty({ description: 'verify.ge-ს მიერ დაბრუნებული მოთხოვნის ID' })
  requestId: string;
}
