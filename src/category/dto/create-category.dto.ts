import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsInt,
  IsUUID,
  MinLength,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCategoryDto {
  @ApiProperty({
    description: 'კატეგორიის სახელი ქართულად',
    example: 'აკუმულატორები',
  })
  @IsString({ message: 'nameKa უნდა იყოს ტექსტური' })
  @IsNotEmpty({ message: 'nameKa სავალდებულოა' })
  @MinLength(2, { message: 'nameKa უნდა შეიცავდეს მინიმუმ 2 სიმბოლოს' })
  nameKa!: string;

  @ApiProperty({
    description: 'კატეგორიის სახელი ინგლისურად',
    example: 'Batteries',
  })
  @IsString({ message: 'nameEn უნდა იყოს ტექსტური' })
  @IsNotEmpty({ message: 'nameEn სავალდებულოა' })
  @MinLength(2, { message: 'nameEn უნდა შეიცავდეს მინიმუმ 2 სიმბოლოს' })
  nameEn!: string;

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
