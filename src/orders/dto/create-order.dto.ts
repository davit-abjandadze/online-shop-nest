import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateOrderDto {
  @ApiProperty({
    description: 'მიწოდების მისამართი',
    example: 'თბილისი, რუსთაველის გამზირი 1',
  })
  @IsString()
  @IsNotEmpty()
  shippingAddress!: string;
}
