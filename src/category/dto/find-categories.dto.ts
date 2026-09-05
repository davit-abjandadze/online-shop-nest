import { IsOptional, IsUUID, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { toQueryBoolean } from '../../common/transforms/query-boolean.transform';

// GET /categories-ის query პარამეტრები — flat სია, pagination + სურვილისამებრ
// ერთი დონის შვილების გაფილტვრა კონკრეტულ მშობელზე (parentId=null-ის შემთხვევა
// root კატეგორიების მისაღებად ცალკე query პარამეტრით არ არის მოცემული, root-ების
// მისაღებად უბრალოდ parentId არ გადაეცემა და ვფილტრავთ service-ში).
export class FindCategoriesDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'მხოლოდ ამ მშობელი კატეგორიის შვილების დაბრუნება',
    example: 'e3b0c442-98fc-1c14-9afc-2c963f66afa6',
  })
  @IsOptional()
  @IsUUID()
  parentId?: string;

  // ADMIN-ისთვისაა (იხ. CategoryService.findAllPaginated) — non-ADMIN-ს
  // ეს პარამეტრი უგულებელყოფილი აქვს, ყოველთვის მხოლოდ აქტიური კატეგორიები
  // უბრუნდება (products.service.ts-ის SearchProductDto-ს იგივე პატერნი).
  @ApiPropertyOptional({
    description: 'გაფილტვრა აქტიურობის მიხედვით (მხოლოდ ADMIN-ისთვის)',
  })
  @IsOptional()
  @Transform(toQueryBoolean)
  @IsBoolean()
  isActive?: boolean;
}
