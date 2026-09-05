import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from './roles.decorator';
import { UserRole } from '../../users/entities/user.entity';

// `@UseGuards(JwtAuthGuard, RolesGuard) @Roles(UserRole.ADMIN) @ApiBearerAuth()`
// კონტროლერების უმეტესობაში (companies, branches და სხვაგან) სიტყვასიტყვით
// მეორდება admin-only route-ებზე — ეს ერთი დეკორატორი აერთიანებს ამ სამივეს.
// გახსოვდეს: guard-ების თანმიმდევრობა მნიშვნელოვანია — JwtAuthGuard ჯერ უნდა
// გაეშვას, რომ request.user შეივსოს, სანამ RolesGuard ამოწმებს როლს.
export function AdminOnly() {
  return applyDecorators(
    UseGuards(JwtAuthGuard, RolesGuard),
    Roles(UserRole.ADMIN),
    ApiBearerAuth(),
  );
}
