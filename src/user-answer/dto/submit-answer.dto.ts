import { IsArray, IsInt, ArrayNotEmpty } from 'class-validator';

export class SubmitAnswerDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true }) // ← ეს არის სწორი!
  answerIds!: number[];
}
