import { IsOptional, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';

// GET /product-sliders/admin-ის query პარამეტრები (ADMIN სია) —
// pagination + სურვილისამებრ isActive-ის მიხედვით გაფილტვრა
// (hero-slides/FindHeroSlidesDto-ს იგივე პატერნი).
export class FindProductSlidersDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'გაფილტვრა აქტიურობის მიხედვით',
    example: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;
}
