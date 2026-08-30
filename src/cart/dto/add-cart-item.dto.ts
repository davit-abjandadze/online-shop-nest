import { IsInt, Min, IsOptional, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddCartItemDto {
  @ApiProperty({ description: 'პროდუქტის ID', example: 1 })
  @Type(() => Number)
  @IsInt({ message: 'productId უნდა იყოს მთელი რიცხვი' })
  productId!: number;

  @ApiPropertyOptional({
    description:
      'არჩეული ფერის ID — სავალდებულოა, თუ პროდუქტს ფერები აქვს მითითებული (იხ. GET /products/:id/colors)',
    example: '5b1a2c3e-...-uuid',
  })
  @IsOptional()
  @IsUUID('4', { message: 'colorId უნდა იყოს ვალიდური UUID' })
  colorId?: string;

  @ApiProperty({ description: 'რაოდენობა', example: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt({ message: 'რაოდენობა უნდა იყოს მთელი რიცხვი' })
  @Min(1, { message: 'რაოდენობა უნდა იყოს მინიმუმ 1' })
  quantity!: number;
}
