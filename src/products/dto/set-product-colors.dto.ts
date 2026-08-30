import {
  IsUUID,
  IsInt,
  Min,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

// PUT /products/:id/colors-ის ერთი ელემენტი — რომელი ფერი (წინასწარ
// /colors-ზე შექმნილი) და რამდენი ცალი მარაგშია ამ ფერზე კონკრეტულად.
export class ProductColorItemDto {
  @ApiProperty({
    description: 'Color-ის ID (წინასწარ /colors-ზე შექმნილი)',
    example: '5b1a2c3e-...-uuid',
  })
  @IsUUID('4', { message: 'colorId უნდა იყოს ვალიდური UUID' })
  colorId!: string;

  @ApiProperty({
    description: 'ამ ფერის მარაგი საწყობში (ცალი)',
    example: 10,
  })
  @Type(() => Number)
  @IsInt({ message: 'stock უნდა იყოს მთელი რიცხვი' })
  @Min(0, { message: 'stock ვერ იქნება უარყოფითი' })
  stock!: number;
}

// bulk set — მოცემული მასივი მთლიანად ანაცვლებს ამ პროდუქტის არსებულ
// ფერებს (delete + recreate, იხ. ProductsService.setColors). ცარიელი
// მასივი ნიშნავს ყველა არსებული ფერის მოხსნას პროდუქტიდან.
export class SetProductColorsDto {
  @ApiProperty({ type: [ProductColorItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductColorItemDto)
  colors!: ProductColorItemDto[];
}
