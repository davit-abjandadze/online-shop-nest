import { ApiProperty } from '@nestjs/swagger';
import { Product } from '../entities/product.entity';

export class ProductResponseDto {
  @ApiProperty({ example: 200 })
  statusCode!: number;

  @ApiProperty({ example: 'პროდუქტი წარმატებით შეიქმნა' })
  message!: string;

  @ApiProperty({ type: () => Product, nullable: true })
  data?: Product;
}
