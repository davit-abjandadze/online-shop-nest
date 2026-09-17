import { ApiProperty } from '@nestjs/swagger';

export class UserSignupBucketDto {
  @ApiProperty({
    example: '2026-09-15',
    description:
      'bucket-ის დაწყების თარიღი/დრო (groupBy-ის მიხედვით, თბილისის დროის ზონაში)',
  })
  date!: string;

  @ApiProperty({ example: 4 })
  count!: number;
}

export class UserSignupsDto {
  @ApiProperty({ type: [UserSignupBucketDto] })
  buckets!: UserSignupBucketDto[];

  @ApiProperty({
    example: 37,
    description:
      'მოთხოვნილ პერიოდში დარეგისტრირებულ მომხმარებელთა საერთო რაოდენობა',
  })
  totalSignups!: number;
}
