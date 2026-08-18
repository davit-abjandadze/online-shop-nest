import {
  IsString,
  IsNotEmpty,
  IsArray,
  ValidateNested,
  IsEnum,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { QuestionType } from '../entities/question.entity';
import { ApiPropertyOptional } from '@nestjs/swagger';

// Answer-ის DTO კითხვის შექმნისას
class CreateAnswerDto {
  @IsString()
  @IsNotEmpty()
  text!: string;
}

export class CreateQuestionDto {
  @IsString()
  @IsNotEmpty()
  text!: string;

  @IsEnum(QuestionType)
  @IsOptional()
  type?: QuestionType; // ნაგულისხმევად SINGLE იქნება

  @ApiPropertyOptional({
    description:
      'კატეგორიების ID-ები (optional, ერთ კითხვას შეიძლება რამდენიმე კატეგორია ჰქონდეს)',
    example: [1, 2],
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @IsNumber(
    {},
    { each: true, message: 'თითოეული კატეგორიის ID უნდა იყოს რიცხვი' },
  )
  @Type(() => Number)
  categoryIds?: number[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAnswerDto)
  answers!: CreateAnswerDto[];

  @ApiPropertyOptional({
    description:
      'აქტიურია თუ არა კითხვა (მხოლოდ admin-ის შექმნილ კითხვას ეხება — user-ის კითხვისთვის ეს ველი იგნორირდება)',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description:
      'დასრულების თარიღი (ISO ფორმატი). ვადის გასვლის შემდეგ კითხვა ავტომატურად გადავა დეაქტივირებულ სიაში. ' +
      'მხოლოდ admin-ის შექმნილ კითხვას ეხება — user-ის მიერ გამოგზავნილი ეს ველი იგნორირდება ' +
      '(user-ის კითხვისთვის დამთავრების თარიღეს ადგენს admin approve-ის დროს)',
    example: '2026-12-31T23:59:59.000Z',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
