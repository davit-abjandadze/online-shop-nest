import { IsInt, Min, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

// PUT /products/:id/branches-ის ერთი ელემენტი — რომელი ფილიალი (წინასწარ
// /branches-ზე შექმნილი) და რამდენი ცალი მარაგშია ამ ფილიალში კონკრეტულად.
export class ProductBranchItemDto {
  @ApiProperty({
    description: 'Branch-ის ID (წინასწარ /branches-ზე შექმნილი)',
    example: 1,
  })
  @Type(() => Number)
  @IsInt({ message: 'branchId უნდა იყოს მთელი რიცხვი' })
  branchId!: number;

  @ApiProperty({
    description: 'ამ ფილიალის მარაგი ამ პროდუქტისთვის (ცალი)',
    example: 10,
  })
  @Type(() => Number)
  @IsInt({ message: 'stock უნდა იყოს მთელი რიცხვი' })
  @Min(0, { message: 'stock ვერ იქნება უარყოფითი' })
  stock!: number;
}

// bulk set — მოცემული მასივი მთლიანად ანაცვლებს ამ პროდუქტის არსებულ
// ფილიალებს (delete + recreate, იხ. ProductsService.setBranches). ცარიელი
// მასივი ნიშნავს ყველა არსებული ფილიალის მოხსნას პროდუქტიდან.
export class SetProductBranchesDto {
  @ApiProperty({ type: [ProductBranchItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductBranchItemDto)
  branches!: ProductBranchItemDto[];
}
