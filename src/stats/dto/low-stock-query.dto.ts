import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';

// PaginationDto-ს page/limit პირდაპირ გადმოგვყავს, sortBy/order კი
// default-ებით გადავაწერთ (stock ASC) — დაბალი მარაგის სია ბუნებრივად
// ყველაზე დაბალი stock-იდან უნდა იწყებოდეს, არა createdAt/DESC-ით
// (PaginationDto-ის საერთო default).
export class LowStockQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description:
      'stock-ის ზღვარი — ამაზე ან ტოლი/დაბალი მარაგის მქონე აქტიური პროდუქტები ჩაითვლება (default იგივეა, რაც /stats/overview-ის lowStockCount-ს იყენებს — 5)',
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  threshold?: number;

  @ApiPropertyOptional({
    description: 'დალაგების ველი',
    example: 'stock',
    default: 'stock',
  })
  @IsOptional()
  sortBy?: string = 'stock';

  @ApiPropertyOptional({
    description: 'დალაგების მიმართულება',
    enum: ['ASC', 'DESC'],
    default: 'ASC',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsIn(['ASC', 'DESC'])
  order?: 'ASC' | 'DESC' = 'ASC';
}
