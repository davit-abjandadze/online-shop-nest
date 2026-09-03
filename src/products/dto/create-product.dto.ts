import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsInt,
  IsArray,
  IsBoolean,
  IsUUID,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductTranslationsDto } from '../../common/dto/translations.dto';

export class CreateProductDto {
  @ApiProperty({
    description:
      'მრავალენოვანი სახელი/აღწერა — { ka: {name, description?}, en?, ru? }, ka სავალდებულოა',
    type: () => ProductTranslationsDto,
  })
  @ValidateNested()
  @Type(() => ProductTranslationsDto)
  translations!: ProductTranslationsDto;

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
    description: 'ფასდაკლება პროცენტებში (0-100)',
    example: 15,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'ფასდაკლება უნდა იყოს მთელი რიცხვი' })
  @Min(0, { message: 'ფასდაკლება არ შეიძლება იყოს უარყოფითი' })
  @Max(100, { message: 'ფასდაკლება არ შეიძლება აღემატებოდეს 100%-ს' })
  discountPercent?: number;

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

  @ApiPropertyOptional({ description: 'წონა (კგ)', example: 1.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'წონა უნდა იყოს რიცხვი' })
  @Min(0, { message: 'წონა არ შეიძლება იყოს უარყოფითი' })
  weight?: number;

  @ApiPropertyOptional({ description: 'სიგრძე (სმ)', example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'სიგრძე უნდა იყოს რიცხვი' })
  @Min(0, { message: 'სიგრძე არ შეიძლება იყოს უარყოფითი' })
  length?: number;

  @ApiPropertyOptional({ description: 'სიგანე (სმ)', example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'სიგანე უნდა იყოს რიცხვი' })
  @Min(0, { message: 'სიგანე არ შეიძლება იყოს უარყოფითი' })
  width?: number;

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

  @ApiProperty({
    description: 'მფლობელი კომპანიის ID (წინასწარ /companies-ზე შექმნილი)',
    example: 'e3b0c442-98fc-1c14-9afc-2c963f66afa6',
  })
  @IsUUID()
  companyId!: string;
}
