import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';
import { ApiHideProperty } from '@nestjs/swagger';
import { encryptedColumnTransformer } from '../../common/utils/encryption.util';

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
  // ბაზაში დაშიფრულად ინახება (encryptedColumnTransformer, AES-256-CBC) — plaintext
  // ვეღარც ბაზის დამპში ჩანს და ვეღარც ლოგებში; `length: 11`-ის ნაცვლად ზოგადი
  // `varchar` საჭირო გახდა, რადგან დაშიფრული (base64) მნიშვნელობა გაცილებით გრძელია.
  @Column({
    type: 'varchar',
    nullable: true,
    transformer: encryptedColumnTransformer,
  })
  personalNumber?: string;

  // ტელეფონის ნომერი — სავალდებულო ველია (DTO-დონეზე @IsNotEmpty).
  // სვეტი nullable-ია, რომ synchronize-მა არსებულ ჩანაწერებზე ALTER-ისას არ დაეცეს.
  // ბაზაში დაშიფრულად ინახება (encryptedColumnTransformer, AES-256-GCM,
  // შემთხვევითი IV — იხ. encryption.util.ts). ⚠️ 2026-09-06: აღარ არის unique
  // და აღარც WHERE-ით ტოლობითი ძებნისთვის გამოიყენება — non-deterministic
  // (random-IV) ciphertext-ზე ვერც ერთი ვერც მეორე იმუშავებდა (ერთი და იგივე
  // ნომერი ყოველ დაშიფვრაზე სხვადასხვა ciphertext-ს იძლევა). ორივესთვის
  // ქვემოთ phoneNumberHash გამოიყენება.
  @Column({
    type: 'varchar',
    nullable: true,
    transformer: encryptedColumnTransformer,
  })
  phoneNumber?: string;

  // ტელეფონის ნომრის blind-index (HMAC-SHA256, დამოუკიდებელი, phoneNumber-ის
  // AES-გასაღებისგან განსხვავებული, წარმოებული key — იხ. hashForSearch()) —
  // ტოლობის შესამოწმებლად (unique-შეზღუდვა + findByPhoneNumber-ის WHERE) და
  // არა თავად დაშიფრული phoneNumber-ის სვეტზე, რომელიც ახლა non-deterministic-ია.
  // UsersService.create/update ივსება ხელით (transformer მხოლოდ ერთ სვეტს
  // მართავს, ცალკე სვეტს ვერ შეავსებდა).
  @Column({ type: 'varchar', nullable: true, unique: true })
  phoneNumberHash?: string;

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

  // პაროლის ბოლო ცვლილების დრო — გამოიყენება უკვე გაცემული JWT-ების
  // ინვალიდაციისთვის (იხ. JwtStrategy.validate): თუ token-ის iat ამ დროზე
  // ადრეულია, ტოკენი უარყოფილია, მიუხედავად იმისა, რომ ხელმოწერა ვალიდურია
  // და ვადა ჯერ არ ამოწურულა. ივსება changePassword/resetPassword-ზე.
  @Column({ type: 'timestamp', nullable: true })
  passwordChangedAt?: Date | null;
}
