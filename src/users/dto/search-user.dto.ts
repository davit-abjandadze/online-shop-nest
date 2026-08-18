import { IsOptional, IsEnum, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { UserRole, Gender } from '../entities/user.entity';

// გაფართოებული ძიების DTO — PaginationDto-ს ვაფართოვებთ საძიებო ფილტრებით,
// რომ /users endpoint-მა support გაუწიოს არა მხოლოდ გვერდვერდობას, არამედ
// სახელით/გვარით/ემეილით ძიებას და role/gender-ით გაფილტვრასაც.
export class SearchUserDto extends PaginationDto {
  @ApiPropertyOptional({
    description:
      'საძიებო ტექსტი — ეძებს firstName, lastName და email ველებში (case-insensitive, ნაწილობრივი დამთხვევაც კმარა)',
    example: 'giorgi',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'გაფილტვრა როლის მიხედვით',
    enum: UserRole,
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({
    description: 'გაფილტვრა სქესის მიხედვით',
    enum: Gender,
  })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;
}
