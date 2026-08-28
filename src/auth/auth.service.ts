import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/create-login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ChangePasswordResponseDto } from './dto/change-password-response.dto';
import { UserRole } from '../users/entities/user.entity';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { EmailService } from '../common/email/email.service';
import { ConfigService } from '@nestjs/config';
import { OtpService } from '../otp/otp.service';
@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private emailService: EmailService,
    private otpService: OtpService,
    private configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto) {
    // თუ SMS-ვერიფიკაცია ჩართულია (PHONE_VERIFICATION_ENABLED), რეგისტრაციამდე
    // ვამოწმებთ, რომ registerDto.phoneNumber-ზე რეალურად მიწოდებული OTP კოდია სწორი.
    // (verify.ge-ს Free tier-ზე მუშაობს მხოლოდ ტესტ-ნომრებთან — production-ისთვის
    // საჭიროა Starter ტარიფზე გადასვლა, იხ. src/otp/otp.service.ts)
    const phoneVerificationEnabled =
      this.configService.get<string>('PHONE_VERIFICATION_ENABLED') !== 'false';

    if (phoneVerificationEnabled) {
      if (!registerDto.otpRequestId || !registerDto.otpCode) {
        throw new BadRequestException(
          'მობილურის ნომრის დასადასტურებლად საჭიროა OTP კოდი — ჯერ გამოიძახეთ POST /otp/send',
        );
      }

      const verified = await this.otpService.verifyOtp(
        registerDto.otpRequestId,
        registerDto.otpCode,
      );
      if (!verified) {
        throw new BadRequestException('OTP კოდი არასწორია ან ვადაგასულია');
      }
    }

    // დავაჰეშოთ პაროლი
    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    // შევქმნათ მომხმარებელი (otpRequestId/otpCode CreateUserDto-ს არ ეკუთვნის — ვაცილებთ)
    const userData = { ...registerDto };
    delete userData.otpRequestId;
    delete userData.otpCode;
    // phoneVerificationEnabled && ვართ აქამდე მისული (ანუ verifyOtp არ დაითროუდა) —
    // ნიშნავს, რომ registerDto.phoneNumber რეალურად OTP-ით დამოწმებულია.
    // ელფოსტა რეგისტრაციაზე არ დამოწმდება (OTP მხოლოდ ტელეფონზეა სავალდებულო).
    const user = await this.usersService.create(
      {
        ...userData,
        password: hashedPassword,
      },
      { isPhoneVerified: phoneVerificationEnabled },
    );

    // დავაბრუნოთ ტოკენი
    return this.generateToken(user);
  }

  async login(loginDto: LoginDto) {
    // ვიპოვოთ მომხმარებელი email-ით
    const user = await this.usersService.findByEmail(loginDto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // შევამოწმოთ პაროლი
    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateToken(user);
  }

  // ← ახალი მეთოდი: პაროლის შეცვლა
  async changePassword(
    userId: number,
    changePasswordDto: ChangePasswordDto,
  ): Promise<ChangePasswordResponseDto> {
    // 1. ვიპოვოთ მომხმარებელი
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('მომხმარებელი ვერ მოიძებნა');
    }

    // 2. შევამოწმოთ, რომ ძველი პაროლი სწორია
    const isOldPasswordValid = await bcrypt.compare(
      changePasswordDto.oldPassword,
      user.password,
    );
    if (!isOldPasswordValid) {
      throw new BadRequestException('ძველი პაროლი არასწორია');
    }

    // 3. შევამოწმოთ, რომ ახალი პაროლი არ ემთხვევა ძველს
    if (changePasswordDto.oldPassword === changePasswordDto.newPassword) {
      throw new BadRequestException(
        'ახალი პაროლი არ უნდა ემთხვეოდეს ძველ პაროლს',
      );
    }

    // 4. დავაჰეშოთ ახალი პაროლი და შევინახოთ
    const hashedNewPassword = await bcrypt.hash(
      changePasswordDto.newPassword,
      10,
    );
    await this.usersService.updatePassword(userId, hashedNewPassword);

    // 5. სტანდარტიზებული პასუხი
    return {
      statusCode: 200,
      message: 'პაროლი წარმატებით შეიცვალა',
    };
  }

  // ⭐ ახალი მეთოდი Google ავტორიზაციისთვის
  async googleLogin(profile: {
    email: string;
    firstName: string;
    lastName: string;
  }) {
    // 1. ვეძებთ მომხმარებელს email-ით
    let user = await this.usersService.findByEmail(profile.email);

    // 2. თუ არ არსებობს, ვქმნით ახალს
    if (!user) {
      const randomPassword = Math.random().toString(36).slice(-8); // შემთხვევითი პაროლი
      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      user = await this.usersService.create(
        {
          email: profile.email,
          firstName: profile.firstName,
          lastName: profile.lastName,
          password: hashedPassword,
          role: UserRole.USER, // ან UserRole.USER, თუ enum-ს იყენებ
        },
        // Google-ით შემოსული ელფოსტა უკვე დამოწმებულია Google-ის მიერ
        { isEmailVerified: true },
      );
    }

    // 3. ვაგენერირებთ ჩვენს JWT ტოკენს (ზუსტად ისე, როგორც ჩვეულებრივ ლოგინში)
    return this.generateToken(user);
  }

  // ⚠️ დროებით გამორთულია Facebook ავტორიზაცია (Facebook App ჯერ Development/Unpublished რეჟიმშია)
  // // ⭐ ახალი მეთოდი Facebook ავტორიზაციისთვის
  // async facebookLogin(profile: { email: string; firstName: string; lastName: string }) {
  //   // 1. ვეძებთ მომხმარებელს email-ით
  //   let user = await this.usersService.findByEmail(profile.email);

  //   // 2. თუ არ არსებობს, ვქმნით ახალს
  //   if (!user) {
  //     const randomPassword = Math.random().toString(36).slice(-8);
  //     const hashedPassword = await bcrypt.hash(randomPassword, 10);

  //     user = await this.usersService.create({
  //       email: profile.email,
  //       firstName: profile.firstName,
  //       lastName: profile.lastName,
  //       password: hashedPassword,
  //       role: UserRole.USER,
  //     });
  //   }

  //   // 3. ვაგენერირებთ ჩვენს JWT ტოკენს
  //   return this.generateToken(user);
  // }

  // ⭐ ახალი მეთოდი: პაროლის აღდგენის მოთხოვნა
  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const user = await this.usersService.findByEmail(forgotPasswordDto.email);

    // უსაფრთხოებისთვის, ყოველთვის ერთსა და იმავეს ვაბრუნებთ (რათა ჰაკერმა ვერ გაიგოს, არსებობს თუ არა მეილი)
    const successMessage = {
      message: 'თუ ეს ელფოსტა რეგისტრირებულია, მიიღებთ ინსტრუქციას',
    };

    if (!user) {
      return successMessage;
    }

    // გენერირება token-ი პაროლის აღდგენისთვის (1 საათიანი ვადით)
    const resetToken = this.jwtService.sign(
      { sub: user.id, email: user.email, type: 'reset' },
      { expiresIn: '1h' },
    );

    // ⭐ აქ ვაგზავნით რეალურ მეილს!
    await this.emailService.sendPasswordResetEmail(user.email, resetToken);

    return successMessage;
  }

  // ⭐ ახალი მეთოდი: პაროლის აღდგენა token-ით
  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    try {
      // ვერიფიკაცია token-ის
      const payload = this.jwtService.verify(resetPasswordDto.token);

      // შევამოწმოთ, რომ ეს მართლაც reset token-ია
      if (payload.type !== 'reset') {
        throw new BadRequestException('არასწორი token-ის ტიპი');
      }

      // ვიპოვოთ მომხმარებელი
      const user = await this.usersService.findById(payload.sub);
      if (!user) {
        throw new BadRequestException('მომხმარებელი ვერ მოიძებნა');
      }

      // დავაჰეშოთ ახალი პაროლი და შევინახოთ
      const hashedPassword = await bcrypt.hash(
        resetPasswordDto.newPassword,
        10,
      );
      await this.usersService.updatePassword(user.id, hashedPassword);

      return { message: 'პაროლი წარმატებით შეიცვალა' };
    } catch (error) {
      if ((error as Error).name === 'TokenExpiredError') {
        throw new BadRequestException(
          'Token-ის ვადა ამოიწურა. გთხოვთ, ხელახლა სცადოთ',
        );
      }
      if ((error as Error).name === 'JsonWebTokenError') {
        throw new BadRequestException('არასწორი token-ი');
      }
      throw error;
    }
  }

  private generateToken(user: any) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role, // ← დავამატეთ პასუხშიც
        gender: user.gender,
        age: user.age,
        personalNumber: user.personalNumber,
        phoneNumber: user.phoneNumber,
        isEmailVerified: user.isEmailVerified,
        isPhoneVerified: user.isPhoneVerified,
      },
    };
  }
}
