import { PartialType, OmitType, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateSizeDto } from './create-size.dto';
import { NamePartialTranslationsDto } from '../../common/dto/translations.dto';

// UpdateColorDto-ის იგივე პატერნი — translations ცალკეა override-ილი
// Partial ვერსიით, რომ PATCH { translations: { en: {...} } } (ka-ს
// გარეშე) 400-ს აღარ აგდებდეს.
export class UpdateSizeDto extends PartialType(
  OmitType(CreateSizeDto, ['translations'] as const),
) {
  @ApiPropertyOptional({ type: () => NamePartialTranslationsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => NamePartialTranslationsDto)
  translations?: NamePartialTranslationsDto;
}
