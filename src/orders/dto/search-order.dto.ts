import { IsOptional, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { OrderStatus } from '../entities/order.entity';

// გაფართოებული ძიების DTO — PaginationDto-ს ვაფართოვებთ status ფილტრით,
// მსგავსად search-product.dto.ts/search-user.dto.ts-ის.
export class SearchOrderDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'გაფილტვრა სტატუსის მიხედვით',
    enum: OrderStatus,
  })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;
}
