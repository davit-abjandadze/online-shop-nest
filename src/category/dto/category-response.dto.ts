import { ApiProperty } from '@nestjs/swagger';
import { Category } from '../entities/category.entity';

export class CategoryResponseDto {
  @ApiProperty({ example: 200 })
  statusCode!: number;

  @ApiProperty({ example: 'კატეგორია წარმატებით შეიქმნა' })
  message!: string;

  @ApiProperty({ type: () => Category, nullable: true })
  data?: Category;
}