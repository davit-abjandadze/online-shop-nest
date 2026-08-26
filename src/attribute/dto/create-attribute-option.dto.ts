import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  MinLength,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAttributeOptionDto {
  @ApiProperty({
    description: 'ოფციის მნიშვნელობა ქართულად',
    example: 'ბანერი',
  })
  @IsString({ message: 'valueKa უნდა იყოს ტექსტური' })
  @IsNotEmpty({ message: 'valueKa სავალდებულოა' })
  @MinLength(1, { message: 'valueKa ცარიელი ვერ იქნება' })
  valueKa!: string;

  @ApiProperty({
    description: 'ოფციის მნიშვნელობა ინგლისურად',
    example: 'Banner',
  })
  @IsString({ message: 'valueEn უნდა იყოს ტექსტური' })
  @IsNotEmpty({ message: 'valueEn სავალდებულოა' })
  @MinLength(1, { message: 'valueEn ცარიელი ვერ იქნება' })
  valueEn!: string;

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
