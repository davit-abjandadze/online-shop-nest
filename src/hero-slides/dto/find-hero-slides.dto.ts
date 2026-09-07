import { IsOptional, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { toQueryBoolean } from '../../common/transforms/query-boolean.transform';

// GET /hero-slides/admin-ის query პარამეტრები (ADMIN სია) — pagination +
// სურვილისამებრ isActive-ის მიხედვით გაფილტვრა.
export class FindHeroSlidesDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'გაფილტვრა აქტიურობის მიხედვით',
    example: true,
  })
  @IsOptional()
  @Transform(toQueryBoolean)
  @IsBoolean()
  isActive?: boolean;
}
