import { UserRole } from '../../users/entities/user.entity';

// `user?.role === UserRole.ADMIN` (ან `role === UserRole.ADMIN`) სიტყვასიტყვით
// მეორდებოდა products/category/users კონტროლერებში და orders.service.ts-ში —
// ერთი წამოღებული ორი დამხმარე ფუნქცია (route guard-ის ნაცვლად გამოსაყენებელი
// იქ, სადაც ADMIN/non-ADMIN ორივეს აქვს წვდომა endpoint-ზე, უბრალოდ სხვადასხვა
// scope-ით — მაგ. non-ADMIN-ს დეაქტივირებული ჩანაწერები არ უჩანს).

export function isAdminRole(role: UserRole | undefined | null): boolean {
  return role === UserRole.ADMIN;
}

export function isAdminUser(user?: { role?: UserRole | null } | null): boolean {
  return isAdminRole(user?.role);
}
