import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/create-login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ChangePasswordResponseDto } from './dto/change-password-response.dto';
import { User, UserRole } from '../users/entities/user.entity';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { EmailService } from '../common/email/email.service';
import { ConfigService } from '@nestjs/config';
import { OtpService } from '../otp/otp.service';
import { OAuth2Client } from 'google-auth-library';
import { maskPersonalNumber, maskPhoneNumber } from '../common/utils/mask.util';
import { isTokenIssuedBeforePasswordChange } from '../common/utils/token-freshness.util';

interface LoginFailures {
  count: number;
  windowStart: number;
}

// OAuth-ით შექმნილი/მიბმული ანგარიშის პაროლი — მომხმარებელმა ის არ იცის
// (პაროლით შესვლისთვის forgot-password-ს გაივლის). Math.random კრიპტოგრაფიულად
// უსაფრთხო არ არის და 8-ზე მოკლე სტრიქონსაც იძლეოდა.
function generateRandomPassword(): string {
  return randomBytes(32).toString('hex');
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  // ელფოსტაზე წარუმატებელი login-ების მთვლელი. ThrottlerGuard მხოლოდ IP-ით
  // ზღუდავს (5/წთ) — IP-ების როტაციით ერთ ანგარიშზე შეუზღუდავი პაროლის
  // გამოცნობა შეიძლებოდა. ⚠️ In-memory: ერთ instance-ზე მუშაობს; რამდენიმე
  // instance-ზე გადასვლისას Redis-ზე გადატანა სჭირდება.
  private readonly loginFailures = new Map<string, LoginFailures>();
  private readonly LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000; // 15 წუთი
  private readonly MAX_LOGIN_FAILURES = 10;

  // Google-ის ID Token-ების ვერიფიკაციისთვის (googleLogin) — client secret არ სჭირდება,
  // მხოლოდ client id-ს (aud claim-ის შესამოწმებლად) და Google-ის public key-ებს, რომლებსაც
  // ეს კლიენტი თავად იტვირთავს/ქეშავს. ერთხელ ვკითხულობთ configService-იდან და ვინახავთ —
  // googleLogin მას აქედან იყენებს ხელახლა კითხვის ნაცვლად.
  private readonly googleClientId?: string;
  private readonly googleOAuthClient: OAuth2Client;

  // Facebook-ის access token-ების ვერიფიკაციისთვის (facebookLogin) — Graph API-ს
  // debug_token endpoint-ს ვეკითხებით (app access token = appId|appSecret), რომ
  // დავრწმუნდეთ token რეალურად ჩვენს აპზეა გაცემული და ვადაგასული არ არის.
  private readonly facebookAppId?: string;
  private readonly facebookAppSecret?: string;

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private emailService: EmailService,
    private otpService: OtpService,
    private configService: ConfigService,
  ) {
    this.googleClientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    this.googleOAuthClient = new OAuth2Client(this.googleClientId);
    this.facebookAppId = this.configService.get<string>('FACEBOOK_CLIENT_ID');
    this.facebookAppSecret = this.configService.get<string>(
      'FACEBOOK_CLIENT_SECRET',
    );
  }

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

      // consumeVerifiedOtp — requestId უნდა იყოს გაცემული სწორედ ამ ნომერზე და
      // ერთჯერადია (იხ. OtpService), თორემ საკუთარ ნომერზე მიღებული ერთი კოდით
      // სხვისი ნომრის „დამოწმება" და მრავალჯერ გამოყენება შეიძლებოდა.
      const verified = await this.otpService.consumeVerifiedOtp(
        registerDto.otpRequestId,
        registerDto.otpCode,
        registerDto.phoneNumber,
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
    this.assertLoginNotLocked(loginDto.email);

    // ვიპოვოთ მომხმარებელი email-ით
    const user = await this.usersService.findByEmail(loginDto.email);
    if (!user) {
      // არარსებულ ელფოსტაზეც ვითვლით — თორემ ლიმიტის ქცევა გაამჟღავნებდა,
      // რომელი ელფოსტაა დარეგისტრირებული.
      this.registerLoginFailure(loginDto.email);
      throw new UnauthorizedException('Invalid credentials');
    }

    // შევამოწმოთ პაროლი
    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );
    if (!isPasswordValid) {
      this.registerLoginFailure(loginDto.email);
      throw new UnauthorizedException('Invalid credentials');
    }

    this.loginFailures.delete(loginDto.email);
    return this.generateToken(user);
  }

  private assertLoginNotLocked(email: string) {
    const entry = this.loginFailures.get(email);
    if (!entry) return;
    if (Date.now() - entry.windowStart > this.LOGIN_FAILURE_WINDOW_MS) {
      this.loginFailures.delete(email);
      return;
    }
    if (entry.count >= this.MAX_LOGIN_FAILURES) {
      throw new HttpException(
        'ძალიან ბევრი წარუმატებელი მცდელობა — სცადეთ 15 წუთში ან აღადგინეთ პაროლი',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private registerLoginFailure(email: string) {
    const now = Date.now();
    const entry = this.loginFailures.get(email);
    if (entry && now - entry.windowStart <= this.LOGIN_FAILURE_WINDOW_MS) {
      entry.count += 1;
    } else {
      this.loginFailures.set(email, { count: 1, windowStart: now });
    }
    // Map-ის შეუზღუდავი ზრდისგან დაცვა (ყოველი ოდესმე ცდილი ელფოსტა).
    if (this.loginFailures.size > 10_000) {
      for (const [key, value] of this.loginFailures) {
        if (now - value.windowStart > this.LOGIN_FAILURE_WINDOW_MS) {
          this.loginFailures.delete(key);
        }
      }
    }
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

    // 5. ახალი ტოკენი — passwordChangedAt-ის განახლების შემდეგ კლიენტის ხელში
    // არსებული ძველი access_token ბათილია (იხ. JwtStrategy.validate), ამიტომ
    // მაშინვე ახალს ვაბრუნებთ, რომ მომხმარებელი უჩუმრად არ „ამოვარდეს".
    const { access_token } = this.generateToken(user);

    // 6. სტანდარტიზებული პასუხი
    return {
      statusCode: 200,
      message: 'პაროლი წარმატებით შეიცვალა',
      access_token,
    };
  }

  // ⭐ Google ავტორიზაცია
  // ⚠️ 2026-09-04: ადრე ეს მეთოდი client-ის მიერ request body-ში გამოგზავნილ email-ს
  // ნდობით იღებდა და პირდაპირ ეძებდა/ქმნიდა მომხმარებელს — ანუ ნებისმიერს შეეძლო
  // POST /auth/google-ზე { email: "victim@site.com", ... } გაეგზავნა და მიეღო
  // access_token ნებისმიერი არსებული ანგარიშისთვის (account takeover, ავტორიზაციის
  // სრული გვერდის ავლა). ახლა idToken-ს ვღებულობთ და Google-ის public key-ებით
  // ვამოწმებთ (ხელმოწერა + aud + issuer + ვადა) — email/სახელი Google-ის მიერ
  // დამოწმებული payload-იდან ვიღებთ, არა client-ისგან.
  async googleLogin(idToken: string) {
    if (!this.googleClientId) {
      throw new UnauthorizedException(
        'Google ავტორიზაცია არ არის კონფიგურირებული (GOOGLE_CLIENT_ID)',
      );
    }

    let payload: {
      email?: string;
      email_verified?: boolean;
      given_name?: string;
      family_name?: string;
    };
    try {
      const ticket = await this.googleOAuthClient.verifyIdToken({
        idToken,
        audience: this.googleClientId,
      });
      payload = ticket.getPayload() ?? {};
    } catch {
      throw new UnauthorizedException('არასწორი ან ვადაგასული Google token');
    }

    if (!payload.email || !payload.email_verified) {
      throw new UnauthorizedException(
        'Google ანგარიშის ელფოსტა არ არის დამოწმებული',
      );
    }

    const profile = {
      email: payload.email.toLowerCase(),
      firstName: payload.given_name ?? '',
      lastName: payload.family_name ?? '',
    };

    // 1. ვეძებთ მომხმარებელს email-ით (ახლა Google-ის მიერ დამოწმებული email-ით)
    let user = await this.usersService.findByEmail(profile.email);

    // 1a. ანგარიში არსებობს, მაგრამ ელფოსტა არასდროს დამოწმებულა — რეგისტრაცია
    // ელფოსტას არ ამოწმებს, ანუ ნებისმიერს შეეძლო victim@gmail.com-ით საკუთარი
    // პაროლით დაერეგისტრირებინა; მსხვერპლი Google-ით შემოსვლისას ამ ანგარიშში
    // აღმოჩნდებოდა, თავდამსხმელი კი პაროლით წვდომას შეინარჩუნებდა (და ხედავდა
    // შეკვეთებს/მისამართებს). Google ახლა ადასტურებს, რომ ელფოსტა მსხვერპლს
    // ეკუთვნის — წინა პაროლს ვაუქმებთ (passwordChangedAt ყველა ძველ სესიას
    // აბათილებს, იხ. JwtStrategy) და ელფოსტას დამოწმებულად ვნიშნავთ.
    if (user && !user.isEmailVerified) {
      const hashedPassword = await bcrypt.hash(generateRandomPassword(), 10);
      await this.usersService.claimAccountByVerifiedEmail(
        user.id,
        hashedPassword,
      );
      user.isEmailVerified = true;
    }

    // 2. თუ არ არსებობს, ვქმნით ახალს
    if (!user) {
      const hashedPassword = await bcrypt.hash(generateRandomPassword(), 10);

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
  // ⭐ Facebook ავტორიზაცია
  // ⚠️ 2026-09-07: ეს მეთოდი ადრე client-ის მიერ request body-ში გამოგზავნილ
  // email/firstName/lastName-ს ნდობით იღებდა (ისევე, როგორც googleLogin ადრე) —
  // ანუ ნებისმიერს შეეძლო POST /auth/facebook-ზე { email: "victim@site.com", ... }
  // გაეგზავნა და მიეღო access_token ნებისმიერი არსებული ანგარიშისთვის (account
  // takeover). ახლა Facebook-ის access token-ს ვღებულობთ და Graph API-ის
  // debug_token endpoint-ით ვამოწმებთ, რომ token ვალიდურია, ვადაგასული არ არის და
  // ჩვენს აპზეა გაცემული (app_id claim) — მხოლოდ ამის შემდეგ ვკითხულობთ
  // დამოწმებულ email/სახელს Graph API-ის /me-დან, არა client-ისგან.
  async facebookLogin(accessToken: string) {
    if (!this.facebookAppId || !this.facebookAppSecret) {
      throw new UnauthorizedException(
        'Facebook ავტორიზაცია არ არის კონფიგურირებული (FACEBOOK_CLIENT_ID/FACEBOOK_CLIENT_SECRET)',
      );
    }

    const appAccessToken = `${this.facebookAppId}|${this.facebookAppSecret}`;

    let debugData: { app_id?: string; is_valid?: boolean; user_id?: string };
    try {
      const debugRes = await fetch(
        `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(
          accessToken,
        )}&access_token=${encodeURIComponent(appAccessToken)}`,
      );
      const debugJson = (await debugRes.json()) as {
        data?: typeof debugData;
      } | null;
      debugData = debugJson?.data ?? {};
    } catch {
      throw new UnauthorizedException(
        'Facebook token-ის ვერიფიკაცია ვერ მოხერხდა',
      );
    }

    if (!debugData.is_valid || debugData.app_id !== this.facebookAppId) {
      throw new UnauthorizedException('არასწორი ან ვადაგასული Facebook token');
    }

    let profileData: {
      email?: string;
      first_name?: string;
      last_name?: string;
    };
    try {
      const profileRes = await fetch(
        `https://graph.facebook.com/me?fields=email,first_name,last_name&access_token=${encodeURIComponent(
          accessToken,
        )}`,
      );
      profileData = (await profileRes.json()) as typeof profileData;
    } catch {
      throw new UnauthorizedException(
        'Facebook პროფილის წამოღება ვერ მოხერხდა',
      );
    }

    if (!profileData.email) {
      throw new UnauthorizedException(
        'Facebook ანგარიშს არ აქვს დამოწმებული ელფოსტა',
      );
    }

    const profile = {
      email: profileData.email.toLowerCase(),
      firstName: profileData.first_name ?? '',
      lastName: profileData.last_name ?? '',
    };

    // 1. ვეძებთ მომხმარებელს email-ით (Facebook-ის მიერ დამოწმებული email-ით)
    let user = await this.usersService.findByEmail(profile.email);

    // 1a. იგივე account-takeover-ის დაცვა, რაც googleLogin-ში (იხ. იქ).
    if (user && !user.isEmailVerified) {
      const hashedPassword = await bcrypt.hash(generateRandomPassword(), 10);
      await this.usersService.claimAccountByVerifiedEmail(
        user.id,
        hashedPassword,
      );
      user.isEmailVerified = true;
    }

    // 2. თუ არ არსებობს, ვქმნით ახალს
    if (!user) {
      const hashedPassword = await bcrypt.hash(generateRandomPassword(), 10);

      user = await this.usersService.create(
        {
          email: profile.email,
          firstName: profile.firstName,
          lastName: profile.lastName,
          password: hashedPassword,
          role: UserRole.USER,
        },
        // Facebook-ით შემოსული ელფოსტა უკვე დამოწმებულია Facebook-ის მიერ
        { isEmailVerified: true },
      );
    }

    // 3. ვაგენერირებთ ჩვენს JWT ტოკენს
    return this.generateToken(user);
  }

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

    // განზრახ await-ის გარეშე: არსებულ ელფოსტაზე Gmail-ის გაგზავნა წამებს
    // იღებს (ჩავარდნისას კი 500-ს აგდებდა), არარსებულზე პასუხი მყისიერი იყო —
    // პასუხის დროით/სტატუსით ირკვეოდა, რომელი ელფოსტაა დარეგისტრირებული.
    this.emailService
      .sendPasswordResetEmail(user.email, resetToken)
      .catch((error: unknown) => {
        this.logger.error(
          `პაროლის აღდგენის ელფოსტა ვერ გაიგზავნა (userId=${user.id})`,
          error instanceof Error ? error.stack : String(error),
        );
      });

    return successMessage;
  }

  // ⭐ ახალი მეთოდი: პაროლის აღდგენა token-ით
  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    try {
      // ვერიფიკაცია token-ის
      const payload = this.jwtService.verify<{
        sub: number;
        email?: string;
        type?: string;
        iat?: number;
      }>(resetPasswordDto.token);

      // შევამოწმოთ, რომ ეს მართლაც reset token-ია
      if (payload.type !== 'reset') {
        throw new BadRequestException('არასწორი token-ის ტიპი');
      }

      // ვიპოვოთ მომხმარებელი
      const user = await this.usersService.findById(payload.sub);
      if (!user) {
        throw new BadRequestException('მომხმარებელი ვერ მოიძებნა');
      }

      // ელფოსტის შეცვლის შემდეგ ძველ მისამართზე გაგზავნილი ბმული აღარ უნდა
      // მუშაობდეს — ელფოსტის ცვლილება passwordChangedAt-ს არ ეხება.
      if (
        typeof payload.email !== 'string' ||
        payload.email.toLowerCase() !== user.email.toLowerCase()
      ) {
        throw new BadRequestException(
          'ეს ბმული აღარ არის აქტუალური — ელფოსტა შეიცვალა',
        );
      }

      // ⚠️ 2026-09-04: reset token თავისი 1სთ ვადის განმავლობაში მრავალჯერ
      // გამოსაყენებელი იყო — ერთხელ პაროლის აღდგენის შემდეგაც კი (ან სხვა
      // change-password/reset-password ოპერაციის შემდეგაც) იგივე ბმული ისევ
      // მუშაობდა, თუ ის გადაუწვდა ვინმეს. ვამოწმებთ, რომ token გაცემულია
      // ბოლო პაროლის ცვლილების შემდეგ — წინააღმდეგ შემთხვევაში ის უკვე
      // მოძველებულია.
      if (
        isTokenIssuedBeforePasswordChange(payload.iat, user.passwordChangedAt)
      ) {
        throw new BadRequestException(
          'ეს ბმული აღარ არის აქტუალური — პაროლი უკვე შეცვლილია',
        );
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

  private generateToken(user: User) {
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
        // ნიღბული ვაბრუნებთ — მთლიანი პირადი ნომერი/ტელეფონი login/register
        // პასუხში აღარ ჩანს, რომ ეს PII არ მოხვდეს request/response ლოგებში
        // ან error-reporting ხელსაწყოებში (იხ. common/utils/mask.util.ts)
        personalNumber: maskPersonalNumber(user.personalNumber),
        phoneNumber: maskPhoneNumber(user.phoneNumber),
        isEmailVerified: user.isEmailVerified,
        isPhoneVerified: user.isPhoneVerified,
      },
    };
  }
}
