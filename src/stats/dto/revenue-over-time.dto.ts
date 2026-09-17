import { ApiProperty } from '@nestjs/swagger';

export class RevenueBucketDto {
  @ApiProperty({
    example: '2026-09-15',
    description:
      'bucket-ის დაწყების თარიღი/დრო (groupBy-ის მიხედვით, თბილისის დროის ზონაში)',
  })
  date!: string;

  @ApiProperty({ example: 1234.56 })
  revenue!: number;
}

export class RevenueOverTimeDto {
  @ApiProperty({ type: [RevenueBucketDto] })
  buckets!: RevenueBucketDto[];

  @ApiProperty({
    example: 15234.5,
    description: 'მოთხოვნილი პერიოდის ჯამური შემოსავალი',
  })
  totalRevenue!: number;

  @ApiProperty({
    example: 12890.25,
    description: 'იმავე ხანგრძლივობის წინა პერიოდის ჯამური შემოსავალი',
  })
  previousPeriodRevenue!: number;

  @ApiProperty({
    example: 18.2,
    description:
      'ცვლილება პროცენტებში წინა პერიოდთან შედარებით — null, თუ წინა პერიოდის შემოსავალი 0 იყო',
    nullable: true,
  })
  changePercent!: number | null;
}
