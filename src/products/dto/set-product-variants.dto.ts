import {
  IsUUID,
  IsInt,
  IsOptional,
  IsNumberString,
  Min,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// PUT /products/:id/variants-ის ერთი ელემენტი — Color+Size კომბინაცია
// (ორივე optional-ია, მაგრამ ProductsService.setVariants მოითხოვს, რომ
// მინიმუმ ერთი მითითებული იყოს), მისი stock და (სურვილისამებრ) საკუთარი
// ფასი — თუ price არაა მითითებული, product.price გამოიყენება checkout-ზე.
export class ProductVariantItemDto {
  @ApiPropertyOptional({
    description: 'Color-ის ID (წინასწარ /colors-ზე შექმნილი)',
    example: '5b1a2c3e-...-uuid',
  })
  @IsOptional()
  @IsUUID('4', { message: 'colorId უნდა იყოს ვალიდური UUID' })
  colorId?: string;

  @ApiPropertyOptional({
    description: 'Size-ის ID (წინასწარ /sizes-ზე შექმნილი)',
    example: '7c2b3d4f-...-uuid',
  })
  @IsOptional()
  @IsUUID('4', { message: 'sizeId უნდა იყოს ვალიდური UUID' })
  sizeId?: string;

  @ApiProperty({
    description: 'ამ ვარიანტის მარაგი საწყობში (ცალი)',
    example: 5,
  })
  @Type(() => Number)
  @IsInt({ message: 'stock უნდა იყოს მთელი რიცხვი' })
  @Min(0, { message: 'stock ვერ იქნება უარყოფითი' })
  stock!: number;

  @ApiPropertyOptional({
    description:
      'ამ ვარიანტის საკუთარი ფასი — თუ არაა მითითებული, product.price გამოიყენება',
    example: '150.00',
  })
  @IsOptional()
  @IsNumberString({}, { message: 'price უნდა იყოს რიცხვითი მნიშვნელობა' })
  price?: string;
}

// bulk set — მოცემული მასივი მთლიანად ანაცვლებს ამ პროდუქტის არსებულ
// ვარიანტებს (delete + recreate, setColors-ის იგივე პატერნი). ცარიელი
// მასივი ნიშნავს ყველა არსებული ვარიანტის მოხსნას პროდუქტიდან.
export class SetProductVariantsDto {
  @ApiProperty({ type: [ProductVariantItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductVariantItemDto)
  variants!: ProductVariantItemDto[];
}
