import { PartialType } from '@nestjs/swagger';
import { CreateCategoryDto } from './create-category.dto';

// PartialType ავტომატურად ხდის CreateCategoryDto-ს ყველა ველს optional-ად
export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}