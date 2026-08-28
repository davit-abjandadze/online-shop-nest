import { PartialType } from '@nestjs/swagger';
import { CreateProductAdditionalInfoDto } from './create-product-additional-info.dto';

// PUT /products/:id/additional-info/:infoId-ის body — ველების ნაწილობრივი განახლება.
export class UpdateProductAdditionalInfoDto extends PartialType(
  CreateProductAdditionalInfoDto,
) {}
