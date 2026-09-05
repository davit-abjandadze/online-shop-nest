import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsInt,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DeliveryMethod } from '../entities/order.entity';

export class CreateOrderDto {
  @ApiPropertyOptional({
    description: 'მიწოდების ხერხი — საკურიერო ან ფილიალიდან გატანა',
    enum: DeliveryMethod,
    default: DeliveryMethod.COURIER,
  })
  @IsOptional()
  @IsEnum(DeliveryMethod)
  deliveryMethod?: DeliveryMethod;

  @ApiPropertyOptional({
    description:
      'მიწოდების მისამართი (deliveryMethod=courier-სთვის სავალდებულო)',
    example: 'თბილისი, რუსთაველის გამზირი 1',
  })
  @ValidateIf(
    (o: CreateOrderDto) =>
      (o.deliveryMethod ?? DeliveryMethod.COURIER) === DeliveryMethod.COURIER,
  )
  @IsString()
  @IsNotEmpty()
  shippingAddress?: string;

  @ApiPropertyOptional({
    description:
      'არჩეული ფილიალის ID (deliveryMethod=pickup-სთვის სავალდებულო)',
  })
  @ValidateIf((o: CreateOrderDto) => o.deliveryMethod === DeliveryMethod.PICKUP)
  @Type(() => Number)
  @IsInt()
  branchId?: number;
}
