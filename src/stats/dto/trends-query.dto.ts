import { IsIn, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export type TrendsPeriod = 'week' | 'month' | 'year';

export class TrendsQueryDto {
  @ApiPropertyOptional({
    description: 'პერიოდი, რომლისთვისაც აიგება ტრენდი',
    enum: ['week', 'month', 'year'],
    default: 'week',
  })
  @IsOptional()
  @IsIn(['week', 'month', 'year'])
  period?: TrendsPeriod = 'week';
}
