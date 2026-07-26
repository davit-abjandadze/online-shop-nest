import { 
  Injectable, 
  UnauthorizedException, 
  ConflictException, 
  BadRequestException 
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/create-login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ChangePasswordResponseDto } from './dto/change-password-response.dto';
import { UserRole } from '../users/entities/user.entity';
@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto) {
    // დავაჰეშოთ პაროლი
    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    // შევქმნათ მომხმარებელი
    const user = await this.usersService.create({
      ...registerDto,
      password: hashedPassword,
    });

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
    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateToken(user);
  }


    // ← ახალი მეთოდი: პაროლის შეცვლა
  async changePassword(
    userId: number, 
    changePasswordDto: ChangePasswordDto
  ): Promise<ChangePasswordResponseDto> {
    // 1. ვიპოვოთ მომხმარებელი
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('მომხმარებელი ვერ მოიძებნა');
    }

    // 2. შევამოწმოთ, რომ ძველი პაროლი სწორია
    const isOldPasswordValid = await bcrypt.compare(
      changePasswordDto.oldPassword, 
      user.password
    );
    if (!isOldPasswordValid) {
      throw new BadRequestException('ძველი პაროლი არასწორია');
    }

    // 3. შევამოწმოთ, რომ ახალი პაროლი არ ემთხვევა ძველს
    if (changePasswordDto.oldPassword === changePasswordDto.newPassword) {
      throw new BadRequestException('ახალი პაროლი არ უნდა ემთხვეოდეს ძველ პაროლს');
    }

    // 4. დავაჰეშოთ ახალი პაროლი და შევინახოთ
    const hashedNewPassword = await bcrypt.hash(changePasswordDto.newPassword, 10);
    await this.usersService.updatePassword(userId, hashedNewPassword);

    // 5. სტანდარტიზებული პასუხი
    return {
      statusCode: 200,
      message: 'პაროლი წარმატებით შეიცვალა',
    };
  }

    // ⭐ ახალი მეთოდი Google ავტორიზაციისთვის
  async googleLogin(profile: { email: string; firstName: string; lastName: string }) {
    // 1. ვეძებთ მომხმარებელს email-ით
    let user = await this.usersService.findByEmail(profile.email);

    // 2. თუ არ არსებობს, ვქმნით ახალს
    if (!user) {
      const randomPassword = Math.random().toString(36).slice(-8); // შემთხვევითი პაროლი
      const hashedPassword = await bcrypt.hash(randomPassword, 10);
      
      user = await this.usersService.create({
        email: profile.email,
        firstName: profile.firstName,
        lastName: profile.lastName,
        password: hashedPassword,
        role: UserRole.USER, // ან UserRole.USER, თუ enum-ს იყენებ
      });
    }

    // 3. ვაგენერირებთ ჩვენს JWT ტოკენს (ზუსტად ისე, როგორც ჩვეულებრივ ლოგინში)
    return this.generateToken(user);
  }

  private generateToken(user: any) {
    const payload = { sub: user.id, email: user.email, role: user.role, };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role, // ← დავამატეთ პასუხშიც
      },
    };
  }
}