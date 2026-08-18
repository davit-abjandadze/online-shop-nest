import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PaginationDto {
  @ApiPropertyOptional({
    description: 'გვერდის ნომერი (იწყება 1-დან)',
    example: 1,
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'ჩანაწერების რაოდენობა თითო გვერდზე',
    example: 10,
    default: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100) // დაცვა ბაზის გადატვირთვისგან
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'დალაგების ველი',
    example: 'createdAt',
    default: 'createdAt',
  })
  @IsOptional()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({
    description: 'დალაგების მიმართულება',
    enum: ['ASC', 'DESC'],
    example: 'DESC',
    default: 'DESC',
  })
  @IsOptional()
  order?: 'ASC' | 'DESC' = 'DESC';
}
