import { IsArray, IsInt, ArrayNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// კითხვის პასუხების ახალი თანმიმდევრობა — answer id-ები, სასურველი მიმდევრობით
// დალაგებული (დრაგ-ენდ-დროპის შედეგი frontend-იდან)
export class ReorderAnswersDto {
  @ApiProperty({
    description:
      'ამ კითხვის ყველა პასუხის ID, ახალი თანმიმდევრობით (ზუსტად ერთხელ თითოეული)',
    example: [3, 1, 2],
    type: [Number],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  answerIds!: number[];
}
