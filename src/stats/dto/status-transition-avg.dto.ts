import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus } from '../../orders/entities/order-status.enum';

export class StatusTransitionAvgItemDto {
  @ApiProperty({ enum: OrderStatus, example: OrderStatus.PENDING })
  fromStatus!: OrderStatus;

  @ApiProperty({ enum: OrderStatus, example: OrderStatus.PAID })
  toStatus!: OrderStatus;

  @ApiProperty({
    example: 5400,
    description: 'საშუალო ხანგრძლივობა წამებში ამ გადასვლისთვის',
  })
  avgSeconds!: number;

  @ApiProperty({
    example: '1 საათი 30 წუთი',
    description: 'ადამიანისთვის წაკითხვადი ფორმატი avgSeconds-ის',
  })
  avgHumanReadable!: string;

  @ApiProperty({
    example: 42,
    description: 'რამდენჯერ მოხდა ეს კონკრეტული გადასვლა პერიოდში',
  })
  transitionCount!: number;
}

export class StatusTransitionAvgDto {
  @ApiProperty({ type: [StatusTransitionAvgItemDto] })
  transitions!: StatusTransitionAvgItemDto[];
}
