import { IsOptional, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ApproveQuestionDto {
  @ApiPropertyOptional({
    description:
      'დამთავრების თარიღი (ISO ფორმატი) — მხოლოდ admin-ს შეუძლია დაწესება დასტურის დროს. ' +
      'ვადის გასვლის შემდეგ კითხვა ავტომატურად გადავა დეაქტივირებულ სიაში',
    example: '2026-12-31T23:59:59.000Z',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
