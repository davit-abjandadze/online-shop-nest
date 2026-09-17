import { ApiProperty } from '@nestjs/swagger';
import { PaymentStatus } from '../../payments/entities/payment.entity';

export class PaymentStatusBreakdownItemDto {
  @ApiProperty({ enum: PaymentStatus, example: PaymentStatus.COMPLETED })
  status!: PaymentStatus;

  @ApiProperty({ example: 25 })
  count!: number;
}

export class PaymentStatsDto {
  // ყველა PaymentStatus წევრი ყოველთვის წარმოდგენილია, count: 0-ითაც კი —
  // იხ. OrderStatusBreakdownDto-ს იგივე მიდგომა.
  @ApiProperty({ type: [PaymentStatusBreakdownItemDto] })
  breakdown!: PaymentStatusBreakdownItemDto[];

  @ApiProperty({
    example: 30,
    description: 'პერიოდში შექმნილი გადახდების საერთო რაოდენობა',
  })
  total!: number;

  @ApiProperty({
    example: 83.3,
    description:
      'COMPLETED სტატუსის წილი პროცენტებში ყველა გადახდას შორის — null, თუ პერიოდში გადახდები არ ყოფილა',
    nullable: true,
  })
  successRatePercent!: number | null;
}
