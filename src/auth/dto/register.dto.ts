import {
  IsEmail,
  IsString,
  MinLength,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  Matches,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Gender } from '../../users/entities/user.entity';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

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

  @IsString()
  @IsNotEmpty({ message: 'ტელეფონის ნომერი სავალდებულოა' })
  phoneNumber!: string;
}
