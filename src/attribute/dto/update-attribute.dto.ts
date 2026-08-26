import { PartialType } from '@nestjs/swagger';
import { CreateAttributeDto } from './create-attribute.dto';

// PartialType ავტომატურად ხდის CreateAttributeDto-ს ყველა ველს optional-ად
export class UpdateAttributeDto extends PartialType(CreateAttributeDto) {}
