import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  // ტოკენის ნებისმიერი პრობლემა (ტოკენი არ არის, ვადაგასულია, არასწორია) აქ
  // ყოველთვის UnauthorizedException-ად უნდა გადაიქცეს — წინააღმდეგ შემთხვევაში
  // `err` (მაგ. passport-jwt-ის TokenExpiredError) ჩვეულებრივ Error-ად
  // "გავარდება" და გლობალური exception filter-ი მას 500-ად აქცევს 401-ის
  // ნაცვლად.
  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      throw new UnauthorizedException(
        info?.message || err?.message || 'Unauthorized',
      );
    }
    return user;
  }
}
