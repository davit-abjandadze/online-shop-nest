import { ApiProperty } from '@nestjs/swagger';

export class BranchSaleDto {
  @ApiProperty({ example: 3 })
  branchId!: number;

  @ApiProperty({ example: 'ჯ. თბილისი, ვაკე' })
  branchTitle!: string;

  @ApiProperty({
    example: 12,
    description: 'ამ ფილიალიდან თვითგატანით შესრულებული შეკვეთების რაოდენობა',
  })
  orderCount!: number;

  @ApiProperty({ example: 1450.75 })
  revenue!: number;
}

export class BranchSalesDto {
  // მხოლოდ DeliveryMethod.PICKUP შეკვეთები — საკურიერო შეკვეთებს branch
  // საერთოდ არ აქვს მინიჭებული (იხ. Order.branch).
  @ApiProperty({ type: [BranchSaleDto] })
  branches!: BranchSaleDto[];
}
