import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RejectQuestionDto {
  @ApiProperty({
    description: 'რატომ არ დაადასტურა admin-მა ეს კითხვა',
    example: 'კითხვის ტექსტი არ არის ნათელი',
  })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
