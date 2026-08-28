import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  Matches,
} from 'class-validator';
import { UserRole, Gender } from '../entities/user.entity';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;

  @IsEmail()
  @IsNotEmpty()
  email!: string;

  // ⭐ ახალი ველი: როლი (Optional, რადგან Google-ით შემოსვლისას ჩვენ ვუთითებთ)
  @ApiPropertyOptional({ enum: UserRole, default: UserRole.USER })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({ enum: Gender, description: 'მომხმარებლის სქესი' })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({ description: 'მომხმარებლის ასაკი' })
  @IsOptional()
  @IsInt()
  @Min(0)
  age?: number;

  @ApiPropertyOptional({
    description: 'პირადი ნომერი — ზუსტად 11 ციფრი',
    example: '01234567890',
  })
  @IsOptional()
  @Matches(/^\d{11}$/, {
    message: 'პირადი ნომერი უნდა შეიცავდეს ზუსტად 11 ციფრს',
  })
  personalNumber?: string;

  // Optional აქ (და არა RegisterDto-სავით სავალდებულო), რადგან ამ DTO-ს იყენებს
  // AuthService.googleLogin-იც, სადაც ტელეფონის ნომერი უბრალოდ არ არსებობს.
  @ApiPropertyOptional({ description: 'მომხმარებლის ტელეფონის ნომერი' })
  @IsOptional()
  @IsString()
  phoneNumber?: string;
}
