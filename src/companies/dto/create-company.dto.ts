import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsInt,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCompanyDto {
  @ApiProperty({
    description: 'კომპანიის დასახელება',
    example: 'ამბოლი',
  })
  @IsString({ message: 'name უნდა იყოს ტექსტური' })
  @IsNotEmpty({ message: 'name სავალდებულოა' })
  @MinLength(2, { message: 'name უნდა შეიცავდეს მინიმუმ 2 სიმბოლოს' })
  name!: string;

  @ApiPropertyOptional({ description: 'კომპანიის აღწერა' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'კომპანიის ლოგოს URL' })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({
    description: 'აქტიურია თუ არა კომპანია',
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
}
