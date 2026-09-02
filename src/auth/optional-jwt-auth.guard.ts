import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// JwtAuthGuard-ის მსგავსი, მაგრამ ტოკენის გარეშე (ან არასწორი/ვადაგასული
// ტოკენით) მოთხოვნასაც უშვებს — request.user უბრალოდ undefined რჩება.
// @nestjs/passport-ის საბაზისო AuthGuard.canActivate ისედაც ყოველთვის
// true-ს აბრუნებს, სანამ handleRequest არაფერს throw-ავს — ამიტომ მხოლოდ
// handleRequest-ის გადაფარვაა საჭირო, რომ ტოკენის ნებისმიერმა პრობლემამ
// 401 აღარ გამოიწვიოს. საჯარო ენდფოინთებისთვის გამოსადეგია, სადაც
// ავტორიზებულმა (მაგ. ADMIN-მა) მეტი უნდა ნახოს, ვიდრე ანონიმურმა
// მომხმარებელმა (იხ. ProductsController.findAll — ADMIN default-ად ხედავს
// დეაქტივირებულ პროდუქტებსაც).
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = unknown>(err: unknown, user: TUser): TUser | undefined {
    return err || !user ? undefined : user;
  }
}
