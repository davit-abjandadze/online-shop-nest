import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  // სურვილისამებრ: შეცდომის შეტყობინების გაუმჯობესება
  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      throw err || new Error('Unauthorized');
    }
    return user;
  }
}