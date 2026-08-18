import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Question } from '../entities/question.entity';
import { Category } from '../../category/entities/category.entity';

export class QuestionResponseDto {
  @ApiProperty({ example: 200 })
  statusCode!: number;

  @ApiProperty({ example: 'კითხვა წარმატებით შეიქმნა' })
  message!: string;

  @ApiPropertyOptional({ type: () => Question })
  data?: Question;
}
