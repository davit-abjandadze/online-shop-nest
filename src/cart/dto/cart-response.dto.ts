import { ApiProperty } from '@nestjs/swagger';
import { Cart } from '../entities/cart.entity';

export class CartResponseDto {
  @ApiProperty({ example: 200 })
  statusCode!: number;

  @ApiProperty({ example: 'კალათა წარმატებით მოიძებნა' })
  message!: string;

  @ApiProperty({ type: () => Cart, nullable: true })
  data?: Cart;
}
