import { IsString, IsNotEmpty, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { NameTranslationsDto } from '../../common/dto/translations.dto';

export class CreateSizeDto {
  @ApiProperty({
    description:
      'მრავალენოვანი სახელი — { ka: {name}, en?, ru? }, ka სავალდებულოა',
    type: () => NameTranslationsDto,
  })
  @ValidateNested()
  @Type(() => NameTranslationsDto)
  translations!: NameTranslationsDto;

  @ApiProperty({
    description: 'მოკლე კოდი (მაგ. "2S", "3XL")',
    example: '2S',
  })
  @IsString({ message: 'code უნდა იყოს ტექსტური' })
  @IsNotEmpty({ message: 'code სავალდებულოა' })
  code!: string;
}
