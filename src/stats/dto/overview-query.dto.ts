import { IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

// /stats/overview-ის ოფციონალური კომპანია-ფილტრი — RevenueQueryDto-ს
// მსგავსად, companyId-ის მოცემისას todayRevenue/monthRevenue/
// activeOrdersCount კონკრეტული კომპანიის მიხედვით გამოითვლება.
export class OverviewQueryDto {
  @ApiPropertyOptional({
    description:
      'გაფილტვრა კონკრეტული კომპანიის მიხედვით (Company.id) — თუ არ არის ' +
      'მითითებული, ყველა კომპანიის მაჩვენებლები ჯამდება',
  })
  @IsOptional()
  @IsUUID()
  companyId?: string;
}
