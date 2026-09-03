import { IsOptional, Matches, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NameTranslationsDto } from '../../common/dto/translations.dto';

export class CreateColorDto {
  @ApiProperty({
    description:
      'მრავალენოვანი სახელი — { ka: {name}, en?, ru? }, ka სავალდებულოა',
    type: () => NameTranslationsDto,
  })
  @ValidateNested()
  @Type(() => NameTranslationsDto)
  translations!: NameTranslationsDto;

  @ApiPropertyOptional({
    description: 'HEX კოდი frontend-ის სვოჩისთვის',
    example: '#FF0000',
  })
  @IsOptional()
  @Matches(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, {
    message: 'hexCode უნდა იყოს ვალიდური HEX ფერი (მაგ. #FF0000)',
  })
  hexCode?: string;
}
