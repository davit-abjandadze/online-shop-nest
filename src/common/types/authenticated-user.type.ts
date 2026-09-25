import { UserRole } from '../../users/entities/user.entity';

// JwtStrategy.validate()-ის დაბრუნებული ობიექტი — request.user-ის ფორმა
// JwtAuthGuard-ით დაცულ route-ებზე.
export interface AuthenticatedUser {
  userId: number;
  email: string;
  role: UserRole;
}
