import { IsOptional, IsInt, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class FindQuestionsQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'კატეგორიის ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  category?: number;

  @ApiPropertyOptional({
    description: 'აქტიურობის სტატუსი (ვადაგასული კითხვები ავტომატურად ითვლება inactive-ად)',
    enum: ['active', 'inactive'],
  })
  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';
}
