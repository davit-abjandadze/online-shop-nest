import { IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { GroupByDto } from './stats-date-range.dto';

// GroupByDto + კომპანიის ფილტრი — companyId მხოლოდ /stats/revenue-ს
// სჭირდება (StatsService.getRevenueOverTime OrderItem.companyId
// snapshot-ზე ფილტრავს), ამიტომ ცალკე DTO-ა, არა თავად GroupByDto-ზე
// დამატება (რომელსაც getUserSignups-იც იზიარებს).
export class RevenueQueryDto extends GroupByDto {
  @ApiPropertyOptional({
    description:
      'გაფილტვრა კონკრეტული კომპანიის მიხედვით (Company.id) — თუ არ არის ' +
      'მითითებული, ყველა კომპანიის შემოსავალი ჯამდება',
  })
  @IsOptional()
  @IsUUID()
  companyId?: string;
}
