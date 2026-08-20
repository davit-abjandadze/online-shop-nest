import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MinLength,
  IsNumber,
  Min,
  IsInt,
  IsArray,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProductDto {
  @ApiProperty({
    description: 'პროდუქტის სახელი',
    example: 'უსადენო ყურსასმენი',
  })
  @IsString({ message: 'სახელი უნდა იყოს ტექსტური' })
  @IsNotEmpty({ message: 'პროდუქტის სახელი სავალდებულოა' })
  @MinLength(2, { message: 'სახელი უნდა შეიცავდეს მინიმუმ 2 სიმბოლოს' })
  name!: string;

  @ApiPropertyOptional({
    description: 'პროდუქტის აღწერა',
    example: 'ბლუთუზ ყურსასმენი, 20 საათი მუშაობის დრო',
  })
  @IsOptional()
  @IsString({ message: 'აღწერა უნდა იყოს ტექსტური' })
  description?: string;

  @ApiProperty({ description: 'ფასი', example: 99.99 })
  @Type(() => Number)
  @IsNumber({}, { message: 'ფასი უნდა იყოს რიცხვი' })
  @Min(0, { message: 'ფასი არ შეიძლება იყოს უარყოფითი' })
  price!: number;

  @ApiPropertyOptional({
    description: 'მარაგში რაოდენობა',
    example: 50,
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'მარაგი უნდა იყოს მთელი რიცხვი' })
  @Min(0, { message: 'მარაგი არ შეიძლება იყოს უარყოფითი' })
  stock?: number;

  @ApiPropertyOptional({
    description: 'სურათების URL-ების სია',
    example: ['https://example.com/img1.jpg'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @ApiPropertyOptional({
    description: 'აქტიურია თუ არა პროდუქტი',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'კატეგორიის ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoryId?: number;
}
