import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';
import { ApiHideProperty } from '@nestjs/swagger';

// 1. შევქმნათ როლების Enum
export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
}

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
}

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ unique: true })
  email: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  role: UserRole;

  @Column({
    type: 'enum',
    enum: Gender,
    nullable: true,
  })
  gender?: Gender;

  @Column({ nullable: true })
  age?: number;

  // პირადი ნომერი — 11-ნიშნა კოდი. DTO-დონეზე სავალდებულო არაა, თუმცა
  // მითითების შემთხვევაში ზუსტად 11 ციფრი უნდა იყოს (იხ. CreateUserDto/RegisterDto).
  @Column({ nullable: true, length: 11 })
  personalNumber?: string;

  // ტელეფონის ნომერი — სავალდებულო ველია (DTO-დონეზე @IsNotEmpty).
  // სვეტი nullable-ია, რომ synchronize-მა არსებულ ჩანაწერებზე ALTER-ისას არ დაეცეს.
  @Column({ nullable: true })
  phoneNumber?: string;

  // ორივე ველი მხოლოდ სერვერზე იმართება (UsersService.create/update) OTP-ის
  // წარმატებული დამოწმების შემდეგ — არასდროს არ იკითხება პირდაპირ კლიენტის
  // მოთხოვნიდან (CreateUserDto/UpdateUserDto-ს არ ეკუთვნის, ValidationPipe-ის
  // whitelist:true+forbidNonWhitelisted:true-ის გამო ასეთი ველი @Body()-დან
  // საერთოდ ვერ მოვა). ამიტომაც შესაძლებელია რომ /ka/user/profile-ზე
  // "დამოწმებულია" სტატუსს ავენდოთ.
  @Column({ default: false })
  isEmailVerified: boolean;

  @Column({ default: false })
  isPhoneVerified: boolean;

  // @ApiHideProperty() // Swagger-ში არ გამოჩნდება
  @Column()
  password: string;

  @CreateDateColumn()
  createdAt: Date;
}
