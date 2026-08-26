import { IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';

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
}
