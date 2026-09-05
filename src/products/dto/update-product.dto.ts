import { PartialType, OmitType, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateProductDto } from './create-product.dto';
import { ProductPartialTranslationsDto } from '../../common/dto/translations.dto';

// PartialType ავტომატურად ხდის CreateProductDto-ს ყველა ველს optional-ად,
// მაგრამ translations-ს მხოლოდ ზედა დონეზე — ჩადგმული ka კვლავ სავალდებულო
// დარჩებოდა (იხ. translations.dto.ts-ის კომენტარი). translations ველი
// OmitType-ით გამორიცხულია PartialType-ის შემოსავალი ტიპიდან და ქვემოთ
// ცალკეა override-ილი Partial ვერსიით (OmitType-ის გარეშე TS ორიგინალ,
// ka-სავალდებულო ტიპთან შეუთავსებლობას დაგვწერდა), რომ PATCH
// { translations: { en: {...} } } (ka-ს გარეშე) 400-ს აღარ აგდებდეს.
export class UpdateProductDto extends PartialType(
  OmitType(CreateProductDto, ['translations'] as const),
) {
  @ApiPropertyOptional({ type: () => ProductPartialTranslationsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProductPartialTranslationsDto)
  translations?: ProductPartialTranslationsDto;
}
