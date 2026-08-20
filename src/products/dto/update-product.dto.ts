import { PartialType } from '@nestjs/swagger';
import { CreateProductDto } from './create-product.dto';

// PartialType ავტომატურად ხდის CreateProductDto-ს ყველა ველს optional-ად
export class UpdateProductDto extends PartialType(CreateProductDto) {}
