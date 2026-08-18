import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. ვიღებთ მოთხოვნილ როლებს დეკორატორიდან
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // თუ როლი არ არის მითითებული, ნებისმიერს შეუძლია შესვლა
    if (!requiredRoles) {
      return true;
    }

    // 2. ვიღებთ მომხმარებელს request-იდან (რომელიც JwtAuthGuard-მა ჩაწერა)
    const { user } = context.switchToHttp().getRequest();

    // 3. ვამოწმებთ, შეესაბამება თუ არა მომხმარებლის როლი მოთხოვნილ როლს
    const hasRole = requiredRoles.some((role) => user.role === role);

    if (!hasRole) {
      throw new ForbiddenException(
        'თქვენ არ გაქვთ ამ მოქმედების შესრულების უფლება',
      );
    }

    return hasRole;
  }
}
