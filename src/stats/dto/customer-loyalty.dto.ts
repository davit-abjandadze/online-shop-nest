import { ApiProperty } from '@nestjs/swagger';

export class CustomerLoyaltyDto {
  @ApiProperty({
    example: 18,
    description:
      'პერიოდში 2 ან მეტი გადახდილი შეკვეთის მქონე მომხმარებელთა რაოდენობა',
  })
  repeatCustomers!: number;

  @ApiProperty({
    example: 42,
    description:
      'პერიოდში ზუსტად 1 გადახდილი შეკვეთის მქონე მომხმარებელთა რაოდენობა',
  })
  oneTimeCustomers!: number;

  @ApiProperty({
    example: 30,
    description:
      'repeatCustomers-ის წილი პროცენტებში ყველა შემძენ მომხმარებელს შორის — null, თუ პერიოდში საერთოდ არავის უყიდია',
    nullable: true,
  })
  repeatRatePercent!: number | null;
}
