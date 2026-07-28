import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PopularQuestionsQueryDto {
  @ApiPropertyOptional({
    description: 'თითო კატეგორიაში დასაბრუნებელი ჩანაწერების რაოდენობა',
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
