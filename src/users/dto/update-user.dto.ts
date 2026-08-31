import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  // ელფოსტის შეცვლისას სავალდებულოა — POST /otp/send-email + POST /otp/verify-email-ის
  // შედეგად მიღებული requestId/code (იხ. UsersService.update). არ ინახება — UsersService
  // წაშლის, სანამ ცვლილება ბაზაში ჩაიწერება.
  @ApiPropertyOptional({
    description:
      'ახალი ელფოსტის დადასტურების requestId (საჭირო email ველის შეცვლისას)',
  })
  @IsOptional()
  @IsString()
  otpRequestId?: string;

  @ApiPropertyOptional({
    description:
      'ახალ ელფოსტაზე მიღებული დადასტურების კოდი (საჭირო email ველის შეცვლისას)',
  })
  @IsOptional()
  @IsString()
  otpCode?: string;

  // მობილურის ნომრის შეცვლისას სავალდებულოა — POST /otp/send + POST /otp/verify-ის
  // (verify.ge) შედეგად მიღებული requestId/code (იხ. UsersService.update). ცალკე
  // ველებია email OTP-სგან, რადგან ორივე ერთდროულადაც შეიძლება იცვლებოდეს.
  @ApiPropertyOptional({
    description:
      'ახალი მობილურის ნომრის დადასტურების requestId (საჭირო phoneNumber ველის შეცვლისას)',
  })
  @IsOptional()
  @IsString()
  phoneOtpRequestId?: string;

  @ApiPropertyOptional({
    description:
      'ახალ მობილურზე SMS-ით მიღებული დადასტურების კოდი (საჭირო phoneNumber ველის შეცვლისას)',
  })
  @IsOptional()
  @IsString()
  phoneOtpCode?: string;
}
