import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET')!,
    });
  }

  // ტოკენი (JWT) stateless არის და 7 დღემდე ვალიდურად ითვლება ისედაც, თუ
  // მომხმარებელი ამასობაში ბაზიდან წაიშალა ადმინის მიერ — payload-ის ხელმოწერა
  // მაინც სწორია. ამიტომ ყოველ authenticated request-ზე დამატებით ვამოწმებთ,
  // რომ token-ში მითითებული user ჯერ კიდევ არსებობს ბაზაში; წინააღმდეგ
  // შემთხვევაში 401-ს ვაბრუნებთ და ფრონტი ამ სიგნალზე გამოაგდებს მომხმარებელს.
  async validate(payload: any) {
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('მომხმარებელი აღარ არსებობს');
    }
    return { userId: payload.sub, email: payload.email, role: payload.role };
  }
}
