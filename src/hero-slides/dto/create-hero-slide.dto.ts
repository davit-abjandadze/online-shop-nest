import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsInt,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HeroSlideTranslationsDto } from '../../common/dto/translations.dto';

export class CreateHeroSlideDto {
  @ApiProperty({
    description:
      'მრავალენოვანი ტექსტი — { ka: {eyebrow?, title, description?, buttonText?}, en?, ru? }, ka სავალდებულოა',
    type: () => HeroSlideTranslationsDto,
  })
  @ValidateNested()
  @Type(() => HeroSlideTranslationsDto)
  translations!: HeroSlideTranslationsDto;

  @ApiProperty({ description: 'სლაიდის სურათის URL' })
  @IsString({ message: 'image უნდა იყოს ტექსტური' })
  @IsNotEmpty({ message: 'image სავალდებულოა' })
  image!: string;

  @ApiPropertyOptional({
    description:
      'ღილაკის ლინკი — თუ productId მითითებულია და buttonLink არა, ' +
      'ღილაკი ავტომატურად პროდუქტის გვერდზე გადადის',
  })
  @IsOptional()
  @IsString()
  buttonLink?: string;

  @ApiPropertyOptional({ description: 'მიბმული პროდუქტის ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  productId?: number;

  @ApiPropertyOptional({ description: 'აქტიურია თუ არა სლაიდი', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'დალაგების რიგი',
    example: 0,
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}
