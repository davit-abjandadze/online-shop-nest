import {
  IsOptional,
  IsNumber,
  IsBoolean,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { toQueryBoolean } from '../../common/transforms/query-boolean.transform';

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
  @Transform(toQueryBoolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description:
      'გაფილტვრა ფასდაკლების მიხედვით — true: მხოლოდ ფასდაკლებიანი, false: მხოლოდ ფასდაკლების გარეშე',
  })
  @IsOptional()
  @Transform(toQueryBoolean)
  @IsBoolean()
  hasDiscount?: boolean;

  @ApiPropertyOptional({
    description: 'ზუსტი ფასდაკლების პროცენტის მიხედვით გაფილტვრა',
    example: 15,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discountPercent?: number;
}
