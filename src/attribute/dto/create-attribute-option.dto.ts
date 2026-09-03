import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ValueTranslationsDto } from '../../common/dto/translations.dto';

export class CreateAttributeOptionDto {
  @ApiProperty({
    description:
      'მრავალენოვანი მნიშვნელობა — { ka: {value}, en?, ru? }, ka სავალდებულოა',
    type: () => ValueTranslationsDto,
  })
  @ValidateNested()
  @Type(() => ValueTranslationsDto)
  translations!: ValueTranslationsDto;

  @ApiProperty({
    description:
      'უნიკალური კოდი (attribute-ის ფარგლებში), მხოლოდ ლათინური ასოები/ციფრები/ტირე',
    example: 'banner',
  })
  @IsString({ message: 'code უნდა იყოს ტექსტური' })
  @IsNotEmpty({ message: 'code სავალდებულოა' })
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message:
      'code უნდა შეიცავდეს მხოლოდ პატარა ლათინურ ასოებს, ციფრებს და ტირეს',
  })
  code!: string;

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
