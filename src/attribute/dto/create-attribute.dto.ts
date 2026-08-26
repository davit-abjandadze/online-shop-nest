import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsInt,
  IsEnum,
  MinLength,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AttributeType } from '../entities/attribute.entity';

export class CreateAttributeDto {
  @ApiProperty({
    description: 'მახასიათებლის სახელი ქართულად',
    example: 'ტევადობა',
  })
  @IsString({ message: 'nameKa უნდა იყოს ტექსტური' })
  @IsNotEmpty({ message: 'nameKa სავალდებულოა' })
  @MinLength(2, { message: 'nameKa უნდა შეიცავდეს მინიმუმ 2 სიმბოლოს' })
  nameKa!: string;

  @ApiProperty({
    description: 'მახასიათებლის სახელი ინგლისურად',
    example: 'Capacity',
  })
  @IsString({ message: 'nameEn უნდა იყოს ტექსტური' })
  @IsNotEmpty({ message: 'nameEn სავალდებულოა' })
  @MinLength(2, { message: 'nameEn უნდა შეიცავდეს მინიმუმ 2 სიმბოლოს' })
  nameEn!: string;

  @ApiProperty({
    description:
      'უნიკალური კოდი (frontend filter query-ებისთვის), მხოლოდ ლათინური ასოები/ციფრები/ტირე',
    example: 'amperage',
  })
  @IsString({ message: 'code უნდა იყოს ტექსტური' })
  @IsNotEmpty({ message: 'code სავალდებულოა' })
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message:
      'code უნდა შეიცავდეს მხოლოდ პატარა ლათინურ ასოებს, ციფრებს და ტირეს',
  })
  code!: string;

  @ApiProperty({
    description:
      'მახასიათებლის ტიპი — განსაზღვრავს, product_attribute_value-ში რომელი value ველი გამოიყენება',
    enum: AttributeType,
    example: AttributeType.SELECT,
  })
  @IsEnum(AttributeType, {
    message: 'type უნდა იყოს ერთ-ერთი AttributeType-დან',
  })
  type!: AttributeType;

  @ApiPropertyOptional({
    description: 'ერთეული (Ah, V, mm...) — number/range ტიპებისთვის',
    example: 'Ah',
  })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional({
    description: 'გამოჩნდება თუ არა filter-ებში',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isFilterable?: boolean;

  @ApiPropertyOptional({
    description: 'სავალდებულოა თუ არა admin ფორმაში',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

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
