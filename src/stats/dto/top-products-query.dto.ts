import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CompanyStatsRangeDto } from './stats-date-range.dto';

export type TopProductsSortBy = 'revenue' | 'quantity';

// ტოპ-გაყიდვადი პროდუქტების query — flat სია + limit (არა paginated),
// იხ. STATS_PLAN.md Phase 2 დაზუსტებული გადაწყვეტილება.
export class TopProductsQueryDto extends CompanyStatsRangeDto {
  @ApiPropertyOptional({
    description: 'დალაგების საზომი',
    enum: ['revenue', 'quantity'],
    default: 'revenue',
  })
  @IsOptional()
  @IsIn(['revenue', 'quantity'])
  sortBy?: TopProductsSortBy = 'revenue';

  @ApiPropertyOptional({
    description: 'დალაგების მიმართულება',
    enum: ['ASC', 'DESC'],
    default: 'DESC',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsIn(['ASC', 'DESC'])
  order?: 'ASC' | 'DESC' = 'DESC';

  @ApiPropertyOptional({
    description: 'პროდუქტების რაოდენობა',
    default: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}
