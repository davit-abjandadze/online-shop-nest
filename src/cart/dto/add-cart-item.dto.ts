import { IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class AddCartItemDto {
  @ApiProperty({ description: 'პროდუქტის ID', example: 1 })
  @Type(() => Number)
  @IsInt({ message: 'productId უნდა იყოს მთელი რიცხვი' })
  productId!: number;

  @ApiProperty({ description: 'რაოდენობა', example: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt({ message: 'რაოდენობა უნდა იყოს მთელი რიცხვი' })
  @Min(1, { message: 'რაოდენობა უნდა იყოს მინიმუმ 1' })
  quantity!: number;
}
