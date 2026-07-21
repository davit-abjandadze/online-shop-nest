import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/create-login.dto';

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