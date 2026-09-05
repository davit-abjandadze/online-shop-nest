import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { isTokenIssuedBeforePasswordChange } from '../common/utils/token-freshness.util';

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
    // ⚠️ 2026-09-04: password-reset ტოკენები იმავე secret-ით/სქემით იწერება, რაც
    // login ტოკენები (განსხვავება მხოლოდ payload-ის `type: 'reset'` claim-შია, 1სთ
    // ვადით) — ადრე ეს strategy ამ claim-ს არ ამოწმებდა, ანუ ვინც reset ბმულს
    // გადაწვდებოდა, მას შეეძლო ის ჩვეულებრივ access token-ად გამოეყენებინა
    // JwtAuthGuard-ით დაცულ ნებისმიერ endpoint-ზე (/auth/profile, /users/:id და ა.შ.)
    // 1 საათის განმავლობაში. აქ ვბლოკავთ ასეთ ტოკენებს — ისინი მხოლოდ
    // resetPassword()-ისთვისაა განკუთვნილი, არა ზოგადი ავტორიზაციისთვის.
    if (payload?.type === 'reset') {
      throw new UnauthorizedException(
        'ეს ტოკენი განკუთვნილია მხოლოდ პაროლის აღდგენისთვის',
      );
    }
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('მომხმარებელი აღარ არსებობს');
    }
    // ⚠️ 2026-09-04: JWT stateless არის — access/reset ტოკენების ინვალიდაცია
    // პაროლის შეცვლისას აქამდე არაფერს აკეთებდა (არც denylist იყო, არც token
    // version), ანუ დაძველებული ან გატეხილი reset-ბმულით მიღებული ტოკენი,
    // ისევე როგორც ძველი access token, კვლავ მუშაობდა თავისი სრული ვადის
    // განმავლობაში პაროლის შეცვლის შემდეგაც. ახლა ვადარებთ token-ის გაცემის
    // დროს (`iat`, წამებში) user.passwordChangedAt-ს — ამ დროზე უფრო
    // ადრეული ტოკენი უარყოფილია, მიუხედავად ვალიდური ხელმოწერისა/ვადისა.
    if (
      isTokenIssuedBeforePasswordChange(payload.iat, user.passwordChangedAt)
    ) {
      throw new UnauthorizedException(
        'პაროლი შეიცვალა — გთხოვთ, ხელახლა გაიაროთ ავტორიზაცია',
      );
    }
    // role-ს ვიღებთ ბაზიდან ახლახან წამოღებული user-იდან და არა token-ის
    // payload-იდან — წინააღმდეგ შემთხვევაში, თუ ადმინს role დაბლა ჩამოეცვლება,
    // ძველი token (7 დღემდე ვალიდური) ისევ role: "admin"-ს დააბრუნებდა და
    // RolesGuard ადმინის endpoint-ებზე წვდომას ისევ დაუშვებდა.
    return { userId: payload.sub, email: payload.email, role: user.role };
  }
}
