import { PartialType, OmitType, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateProductSliderDto } from './create-product-slider.dto';
import { ProductSliderPartialTranslationsDto } from '../../common/dto/translations.dto';

// PartialType ავტომატურად ხდის CreateProductSliderDto-ს ყველა ველს
// optional-ად (productIds-ის ჩათვლით — თუ გამოგზავნილია, items მთლიანად
// ანაცვლდება, hero-slides/UpdateHeroSlideDto-ს იგივე პატერნი), მაგრამ
// translations-ს მხოლოდ ზედა დონეზე — ჩადგმული ka კვლავ სავალდებულო
// დარჩებოდა (იხ. translations.dto.ts-ის კომენტარი). translations ველი
// OmitType-ით გამორიცხულია PartialType-ის შემოსავალი ტიპიდან და ქვემოთ
// ცალკეა override-ილი Partial ვერსიით, რომ PATCH { translations: { en: {...} } }
// (ka-ს გარეშე) 400-ს აღარ აგდებდეს.
export class UpdateProductSliderDto extends PartialType(
  OmitType(CreateProductSliderDto, ['translations'] as const),
) {
  @ApiPropertyOptional({ type: () => ProductSliderPartialTranslationsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProductSliderPartialTranslationsDto)
  translations?: ProductSliderPartialTranslationsDto;
}
