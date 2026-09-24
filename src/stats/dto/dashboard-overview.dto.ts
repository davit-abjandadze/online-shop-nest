import { ApiProperty } from '@nestjs/swagger';

export class DashboardOverviewDto {
  @ApiProperty({
    example: 245.5,
    description: 'დღევანდელი შემოსავალი (გადახდილი სტატუსების შეკვეთები)',
  })
  todayRevenue!: number;

  @ApiProperty({
    example: 5230.75,
    description: 'მიმდინარე თვის შემოსავალი (გადახდილი სტატუსების შეკვეთები)',
  })
  monthRevenue!: number;

  @ApiProperty({
    example: 12,
    description: 'აქტიური შეკვეთების რაოდენობა (PENDING + PAID + PROCESSING)',
  })
  activeOrdersCount!: number;

  @ApiProperty({
    example: 3,
    description: 'დღეს დარეგისტრირებული ახალი მომხმარებლების რაოდენობა',
  })
  newUsersToday!: number;

  @ApiProperty({
    example: 7,
    description:
      'დაბალი მარაგის მქონე აქტიური პროდუქტების რაოდენობა (ჯამური, ფერის ან ვარიანტის მარაგით)',
  })
  lowStockCount!: number;
}
