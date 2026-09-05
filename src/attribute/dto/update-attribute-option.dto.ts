import { PartialType, OmitType, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateAttributeOptionDto } from './create-attribute-option.dto';
import { ValuePartialTranslationsDto } from '../../common/dto/translations.dto';

// PartialType ავტომატურად ხდის CreateAttributeOptionDto-ს ყველა ველს
// optional-ად, მაგრამ translations-ს მხოლოდ ზედა დონეზე — ჩადგმული ka
// კვლავ სავალდებულო დარჩებოდა (იხ. translations.dto.ts-ის კომენტარი).
// translations ველი OmitType-ით გამორიცხულია PartialType-ის შემოსავალი
// ტიპიდან და ქვემოთ ცალკეა override-ილი Partial ვერსიით, რომ
// PATCH { translations: { en: {...} } } (ka-ს გარეშე) 400-ს აღარ აგდებდეს.
export class UpdateAttributeOptionDto extends PartialType(
  OmitType(CreateAttributeOptionDto, ['translations'] as const),
) {
  @ApiPropertyOptional({ type: () => ValuePartialTranslationsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ValuePartialTranslationsDto)
  translations?: ValuePartialTranslationsDto;
}
