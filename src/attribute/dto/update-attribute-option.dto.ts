import { PartialType } from '@nestjs/swagger';
import { CreateAttributeOptionDto } from './create-attribute-option.dto';

export class UpdateAttributeOptionDto extends PartialType(
  CreateAttributeOptionDto,
) {}
