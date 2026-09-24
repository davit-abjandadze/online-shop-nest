import { IsOptional, IsDateString, IsIn, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export type StatsGroupBy = 'day' | 'week' | 'month';

// საერთო from/to query DTO ყველა სტატისტიკის endpoint-ისთვის — თავად
// default-ის დაანგარიშება (to=ახლა, from=ახლა-30დღე) StatsService-შია,
// რადგან "ახლა" request-დროზეა დამოკიდებული და DTO-ს დონეზე static
// default ვერ დაისმის.
export class StatsDateRangeDto {
  @ApiPropertyOptional({
    description: 'პერიოდის დასაწყისი (ISO 8601), ნაგულისხმევი — 30 დღით ადრე',
    example: '2026-08-18',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description:
      'პერიოდის დასასრული (ISO 8601), ნაგულისხმევი — ახლანდელი მომენტი',
    example: '2026-09-17',
  })
  @IsOptional()
  @IsDateString()
  to?: string;
}

// StatsDateRangeDto + კომპანიის ფილტრი — ყველა შეკვეთა/პროდუქტზე
// დაფუძნებული endpoint-ისთვის (შემოსავალი, სტატუსები, ტოპ-პროდუქტები,
// ლოიალობა, გადახდები, ფილიალები). შეკვეთა კომპანიას "ეკუთვნის", თუ მასში
// ამ კომპანიის სულ ცოტა ერთი OrderItem-ია (OrderItem.companyId snapshot).
export class CompanyStatsRangeDto extends StatsDateRangeDto {
  @ApiPropertyOptional({
    description:
      'გაფილტვრა კონკრეტული კომპანიის მიხედვით (Company.id) — თუ არ არის ' +
      'მითითებული, ყველა კომპანიის მონაცემები ჯამდება',
  })
  @IsOptional()
  @IsUUID()
  companyId?: string;
}

// bucketing-ის ინტერვალის დამატება StatsDateRangeDto-ს თავზე — რევენიუს
// და მომხმარებელთა რეგისტრაციის time-series endpoint-ებისთვის.
export class GroupByDto extends StatsDateRangeDto {
  @ApiPropertyOptional({
    description: 'დაჯგუფების ინტერვალი',
    enum: ['day', 'week', 'month'],
    default: 'day',
  })
  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  groupBy?: StatsGroupBy = 'day';
}
