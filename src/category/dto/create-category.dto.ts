import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsInt,
  IsUUID,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NameTranslationsDto } from '../../common/dto/translations.dto';

export class CreateCategoryDto {
  @ApiProperty({
    description:
      'მრავალენოვანი სახელი — { ka: {name}, en?, ru? }, ka სავალდებულოა',
    type: () => NameTranslationsDto,
  })
  @ValidateNested()
  @Type(() => NameTranslationsDto)
  translations!: NameTranslationsDto;

  @ApiProperty({
    description:
      'უნიკალური slug URL-ისთვის (მხოლოდ ლათინური ასოები, ციფრები, ტირე)',
    example: 'batteries',
  })
  @IsString({ message: 'slug უნდა იყოს ტექსტური' })
  @IsNotEmpty({ message: 'slug სავალდებულოა' })
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message:
      'slug უნდა შეიცავდეს მხოლოდ პატარა ლათინურ ასოებს, ციფრებს და ტირეს',
  })
  slug!: string;

  @ApiPropertyOptional({
    description: 'მშობელი კატეგორიის ID (ცარიელი — root კატეგორია)',
    example: 'e3b0c442-98fc-1c14-9afc-2c963f66afa6',
  })
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiPropertyOptional({
    description: 'აქტიურია თუ არა კატეგორია',
    default: true,
  })
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

  @ApiPropertyOptional({ description: 'კატეგორიის სურათის URL' })
  @IsOptional()
  @IsString()
  image?: string;

  @ApiPropertyOptional({ description: 'SEO სათაური' })
  @IsOptional()
  @IsString()
  seoTitle?: string;

  @ApiPropertyOptional({ description: 'SEO აღწერა' })
  @IsOptional()
  @IsString()
  seoDescription?: string;

  @ApiPropertyOptional({ description: 'SEO საკვანძო სიტყვები' })
  @IsOptional()
  @IsString()
  seoKeywords?: string;
}
