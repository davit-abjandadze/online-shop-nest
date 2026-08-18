import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAnswerDto {
  @ApiProperty({
    description: 'პასუხის ტექსტი',
    example: 'თბილისი',
  })
  @IsString()
  @IsNotEmpty()
  text: string;
}
