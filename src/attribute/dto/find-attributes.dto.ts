import { IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { AttributeType } from '../entities/attribute.entity';
import { toQueryBoolean } from '../../common/transforms/query-boolean.transform';

// GET /attributes-ის query პარამეტრები — pagination + სურვილისამებრ
// ტიპის/isFilterable-ის მიხედვით გაფილტვრა.
export class FindAttributesDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'მხოლოდ ამ ტიპის attribute-ები',
    enum: AttributeType,
  })
  @IsOptional()
  @IsEnum(AttributeType)
  type?: AttributeType;

  @ApiPropertyOptional({
    description: 'მხოლოდ filterable (ან non-filterable) attribute-ები',
  })
  @IsOptional()
  @Transform(toQueryBoolean)
  @IsBoolean()
  isFilterable?: boolean;
}
