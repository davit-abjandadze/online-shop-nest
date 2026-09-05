import { PartialType, OmitType, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateHeroSlideDto } from './create-hero-slide.dto';
import { HeroSlidePartialTranslationsDto } from '../../common/dto/translations.dto';

// PartialType ავტომატურად ხდის CreateHeroSlideDto-ს ყველა ველს optional-ად,
// მაგრამ translations-ს მხოლოდ ზედა დონეზე — ჩადგმული ka კვლავ სავალდებულო
// დარჩებოდა (იხ. translations.dto.ts-ის კომენტარი). translations ველი
// OmitType-ით გამორიცხულია PartialType-ის შემოსავალი ტიპიდან და ქვემოთ
// ცალკეა override-ილი Partial ვერსიით, რომ PATCH { translations: { en: {...} } }
// (ka-ს გარეშე) 400-ს აღარ აგდებდეს.
export class UpdateHeroSlideDto extends PartialType(
  OmitType(CreateHeroSlideDto, ['translations'] as const),
) {
  @ApiPropertyOptional({ type: () => HeroSlidePartialTranslationsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => HeroSlidePartialTranslationsDto)
  translations?: HeroSlidePartialTranslationsDto;
}
