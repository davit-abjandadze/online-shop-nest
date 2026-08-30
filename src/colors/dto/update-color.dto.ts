import { PartialType } from '@nestjs/swagger';
import { CreateColorDto } from './create-color.dto';

// PartialType ავტომატურად ხდის CreateColorDto-ს ყველა ველს optional-ად
export class UpdateColorDto extends PartialType(CreateColorDto) {}
