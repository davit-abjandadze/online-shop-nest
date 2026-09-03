import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsInt,
  Matches,
  ValidateNested,
  IsArray,
  ArrayUnique,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductSliderTranslationsDto } from '../../common/dto/translations.dto';

export class CreateProductSliderDto {
  @ApiProperty({
    description:
      'სტაბილური იდენტიფიკატორი (slug), რომლითაც frontend-ი ბლოკს ' +
      'ნებისმიერ გვერდზე embed-ავს — GET /product-sliders/key/:key',
    example: 'home-featured',
  })
  @IsString({ message: 'key უნდა იყოს ტექსტური' })
  @IsNotEmpty({ message: 'key სავალდებულოა' })
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message:
      'key შეიძლება შეიცავდეს მხოლოდ ლათინურ პატარა ასოებს, ციფრებს და დეფისს (მაგ. home-featured)',
  })
  key!: string;

  @ApiProperty({
    description:
      'მრავალენოვანი ტექსტი — { ka: {title, viewAllText?}, en?, ru? }, ka სავალდებულოა',
    type: () => ProductSliderTranslationsDto,
  })
  @ValidateNested()
  @Type(() => ProductSliderTranslationsDto)
  translations!: ProductSliderTranslationsDto;

  @ApiPropertyOptional({
    description:
      '"ყველას ნახვა" ღილაკის ლინკი (მაგ. კონკრეტულ კატეგორიაზე ან ფილტრზე)',
  })
  @IsOptional()
  @IsString()
  viewAllLink?: string;

  @ApiPropertyOptional({ description: 'აქტიურია თუ არა ბლოკი', default: true })
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

  @ApiPropertyOptional({
    description:
      'ბლოკში ჩასასმელი პროდუქტების ID-ები, სასურველი რიგით (მასივის ' +
      'თანმიმდევრობა = ჩვენების რიგი). სურვილისამებრ — შემდეგ ცალკეც ' +
      'შეიძლება PUT /product-sliders/:id/items-ით',
    type: [Number],
    example: [3, 7, 12],
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  productIds?: number[];
}
