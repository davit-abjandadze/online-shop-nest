import { 
  IsString, IsNotEmpty, IsArray, 
  ValidateNested, IsEnum, IsOptional 
} from 'class-validator';
import { Type } from 'class-transformer';
import { QuestionType } from '../entities/question.entity';

// Answer-ის DTO კითხვის შექმნისას
class CreateAnswerDto {
  @IsString()
  @IsNotEmpty()
  text: string;
}

export class CreateQuestionDto {
  @IsString()
  @IsNotEmpty()
  text: string;

  @IsEnum(QuestionType)
  @IsOptional()
  type?: QuestionType; // ნაგულისხმევად SINGLE იქნება

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAnswerDto)
  answers: CreateAnswerDto[];
}