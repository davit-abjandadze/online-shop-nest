import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus } from '../../orders/entities/order-status.enum';

export class OrderStatusBreakdownItemDto {
  @ApiProperty({ enum: OrderStatus, example: OrderStatus.PENDING })
  status!: OrderStatus;

  @ApiProperty({ example: 8 })
  count!: number;
}

export class OrderStatusBreakdownDto {
  // ყველა OrderStatus წევრი ყოველთვის წარმოდგენილია, count: 0-ითაც კი —
  // ფრონტს არ სჭირდება enum-ის sparse-სიის საწინააღმდეგოდ დაცვა (მაგ.
  // chart-ის ცარიელი slice-ები).
  @ApiProperty({ type: [OrderStatusBreakdownItemDto] })
  breakdown!: OrderStatusBreakdownItemDto[];

  @ApiProperty({
    example: 42,
    description: 'პერიოდში შექმნილი შეკვეთების საერთო რაოდენობა',
  })
  total!: number;
}
