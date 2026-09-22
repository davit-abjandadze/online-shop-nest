import {
  IsInt,
  IsUUID,
  IsOptional,
  Min,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// PUT /products/:id/branches-ის ერთი ელემენტი — რომელი ფილიალი (წინასწარ
// /branches-ზე შექმნილი), სურვილისამებრ კონკრეტული variantId (ვარიანტიანი
// პროდუქტისთვის) ან colorId (ძველი ფლეთი ფერიანი პროდუქტისთვის) — ორივე
// ერთდროულად დაუშვებელია, ProductsService.setBranches ამოწმებს — და რამდენი
// ცალი მარაგშია ამ ფილიალში კონკრეტულად. ვარიანტიან პროდუქტზე თითოეულ
// ფილიალს შეიძლება ჰქონდეს რამდენიმე row (თითო variantId-ზე ერთი).
export class ProductBranchItemDto {
  @ApiProperty({
    description: 'Branch-ის ID (წინასწარ /branches-ზე შექმნილი)',
    example: 1,
  })
  @Type(() => Number)
  @IsInt({ message: 'branchId უნდა იყოს მთელი რიცხვი' })
  branchId!: number;

  @ApiPropertyOptional({
    description:
      'ProductVariant-ის ID — თუ პროდუქტს ვარიანტები აქვს, სავალდებულოა და colorId-სთან ერთად არ დაიშვება',
    example: '5b1a2c3e-...-uuid',
  })
  @IsOptional()
  @IsUUID('4', { message: 'variantId უნდა იყოს ვალიდური UUID' })
  variantId?: string;

  @ApiPropertyOptional({
    description:
      'Color-ის ID — ძველი ფლეთი ფერიანი პროდუქტისთვის, variantId-სთან ერთად არ დაიშვება',
    example: '7c2b3d4f-...-uuid',
  })
  @IsOptional()
  @IsUUID('4', { message: 'colorId უნდა იყოს ვალიდური UUID' })
  colorId?: string;

  @ApiProperty({
    description: 'ამ ფილიალის მარაგი ამ პროდუქტისთვის/ვარიანტისთვის (ცალი)',
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
