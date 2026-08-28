import { IsString, IsNotEmpty, IsOptional, IsInt } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// POST /products/:id/additional-info-ის body — ერთი დამატებითი
// ინფორმაციის ბლოკის შექმნა (სათაური + აღწერილობა).
export class CreateProductAdditionalInfoDto {
  @ApiProperty({
    description: 'ბლოკის სათაური',
    example: 'მიწოდების პირობები',
  })
  @IsString()
  @IsNotEmpty({ message: 'title სავალდებულოა' })
  title!: string;

  @ApiProperty({
    description: 'ბლოკის აღწერილობა',
    example: 'მიწოდება ხდება 1-3 სამუშაო დღეში მთელ საქართველოში.',
  })
  @IsString()
  @IsNotEmpty({ message: 'description სავალდებულოა' })
  description!: string;

  @ApiPropertyOptional({
    description: 'ბლოკების თანმიმდევრობა პროდუქტის გვერდზე',
    example: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}
