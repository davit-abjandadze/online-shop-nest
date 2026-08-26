import { IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { AttributeType } from '../entities/attribute.entity';

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
  @Type(() => Boolean)
  @IsBoolean()
  isFilterable?: boolean;
}
