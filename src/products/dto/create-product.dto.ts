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
  IsUUID,
  Matches,
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
    description:
      'YouTube ვიდეოს ლინკი (მიმოხილვა/ინსტრუქცია პროდუქტის გვერდზე)',
    example: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  })
  @IsOptional()
  @Matches(
    /^https?:\/\/(www\.)?(youtube\.com\/(watch\?v=|shorts\/|embed\/)|youtu\.be\/)[\w-]+/,
    { message: 'videoUrl უნდა იყოს valid YouTube ლინკი' },
  )
  videoUrl?: string;

  @ApiPropertyOptional({
    description: 'აქტიურია თუ არა პროდუქტი',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'კატეგორიის ID',
    example: 'e3b0c442-98fc-1c14-9afc-2c963f66afa6',
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;
}
