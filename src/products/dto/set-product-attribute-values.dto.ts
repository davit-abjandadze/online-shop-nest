import {
  IsUUID,
  IsOptional,
  IsString,
  IsNumber,
  IsBoolean,
  IsArray,
  ArrayUnique,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// PUT /products/:id/attribute-values-ის ერთი ელემენტი — რომელი value-ველი
// გამოიყენება, დამოკიდებულია attribute.type-ზე (ProductsService ამოწმებს):
// select → attributeOptionId, multi_select → attributeOptionIds,
// number/range → valueNumber, text → valueText, boolean → valueBoolean.
export class ProductAttributeValueItemDto {
  @ApiProperty({
    description: 'Attribute-ის ID, რომლისთვისაც მნიშვნელობა ინახება',
    example: '5b1a2c3e-...-uuid',
  })
  @IsUUID('4', { message: 'attributeId უნდა იყოს ვალიდური UUID' })
  attributeId!: string;

  @ApiPropertyOptional({ description: 'არჩეული option (select ტიპისთვის)' })
  @IsOptional()
  @IsUUID('4', { message: 'attributeOptionId უნდა იყოს ვალიდური UUID' })
  attributeOptionId?: string;

  @ApiPropertyOptional({
    description: 'არჩეული option-ები (multi_select ტიპისთვის)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', {
    each: true,
    message: 'attributeOptionIds-ის თითოეული ელემენტი უნდა იყოს ვალიდური UUID',
  })
  // დუბლირებული option ID წინააღმდეგ შემთხვევაში DB-ის unique constraint-ს
  // (ProductAttributeValue) დაარტყამდა პირდაპირ — უცხო raw 500 კლიენტისთვის
  // 400-ის ნაცვლად (setColors/setBranches-ის იგივე ArrayUnique პატერნი).
  @ArrayUnique({ message: 'attributeOptionIds არ უნდა შეიცავდეს დუბლიკატებს' })
  attributeOptionIds?: string[];

  @ApiPropertyOptional({ description: 'ტექსტური მნიშვნელობა (text ტიპისთვის)' })
  @IsOptional()
  @IsString()
  valueText?: string;

  @ApiPropertyOptional({
    description: 'რიცხვითი მნიშვნელობა (number/range ტიპისთვის)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  valueNumber?: number;

  @ApiPropertyOptional({
    description: 'ლოგიკური მნიშვნელობა (boolean ტიპისთვის)',
  })
  @IsOptional()
  @IsBoolean()
  valueBoolean?: boolean;
}

// bulk set — ამ პროდუქტის ყველა attribute value ერთი მოთხოვნით
// ჩანაცვლდება მოცემული მასივით (delete + recreate, იხ. ProductsService).
// ცარიელი მასივი ნიშნავს ყველა არსებული value-ის წაშლას.
export class SetProductAttributeValuesDto {
  @ApiProperty({ type: [ProductAttributeValueItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductAttributeValueItemDto)
  values!: ProductAttributeValueItemDto[];
}
