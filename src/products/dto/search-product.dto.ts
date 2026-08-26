import {
  IsOptional,
  IsNumber,
  IsBoolean,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';

// გაფართოებული ძიების DTO — PaginationDto-ს ვაფართოვებთ საძიებო ფილტრებით,
// მსგავსად src/users/dto/search-user.dto.ts-ის.
export class SearchProductDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'საძიებო ტექსტი — ეძებს name და description ველებში',
    example: 'ყურსასმენი',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'გაფილტვრა კატეგორიის მიხედვით',
    example: 'e3b0c442-98fc-1c14-9afc-2c963f66afa6',
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'მინიმალური ფასი', example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ description: 'მაქსიმალური ფასი', example: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({ description: 'გაფილტვრა აქტიურობის მიხედვით' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;
}
