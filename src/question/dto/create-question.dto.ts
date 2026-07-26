import { 
  IsString, IsNotEmpty, IsArray, 
  ValidateNested, IsEnum, IsOptional, 
  IsNumber
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
    description: 'კატეგორიის ID (optional)', 
    example: 1 
  })
  @IsOptional()
  @IsNumber({}, { message: 'კატეგორიის ID უნდა იყოს რიცხვი' })
  @Type(() => Number)
  categoryId?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAnswerDto)
  answers!: CreateAnswerDto[];
}