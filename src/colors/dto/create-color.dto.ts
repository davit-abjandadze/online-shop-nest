import { IsString, IsNotEmpty, IsOptional, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateColorDto {
  @ApiProperty({ description: 'ფერის სახელი ქართულად', example: 'წითელი' })
  @IsString({ message: 'nameKa უნდა იყოს ტექსტური' })
  @IsNotEmpty({ message: 'nameKa სავალდებულოა' })
  nameKa!: string;

  @ApiProperty({ description: 'ფერის სახელი ინგლისურად', example: 'Red' })
  @IsString({ message: 'nameEn უნდა იყოს ტექსტური' })
  @IsNotEmpty({ message: 'nameEn სავალდებულოა' })
  nameEn!: string;

  @ApiPropertyOptional({
    description: 'HEX კოდი frontend-ის სვოჩისთვის',
    example: '#FF0000',
  })
  @IsOptional()
  @Matches(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, {
    message: 'hexCode უნდა იყოს ვალიდური HEX ფერი (მაგ. #FF0000)',
  })
  hexCode?: string;
}
