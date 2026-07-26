import { IsString, IsNotEmpty, IsOptional, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCategoryDto {
  @ApiProperty({ 
    description: 'კატეგორიის სახელი', 
    example: 'პოლიტიკა' 
  })
  @IsString({ message: 'სახელი უნდა იყოს ტექსტური' })
  @IsNotEmpty({ message: 'კატეგორიის სახელი სავალდებულოა' })
  @MinLength(2, { message: 'სახელი უნდა შეიცავდეს მინიმუმ 2 სიმბოლოს' })
  name!: string;

  @ApiPropertyOptional({ 
    description: 'კატეგორიის მოკლე აღწერა', 
    example: 'პოლიტიკური სიახლეები და გამოკითხვები' 
  })
  @IsString({ message: 'აღწერა უნდა იყოს ტექსტური' })
  @IsOptional()
  description?: string;
}