import { PartialType } from '@nestjs/swagger';
import { CreateHeroSlideDto } from './create-hero-slide.dto';

// PartialType ავტომატურად ხდის CreateHeroSlideDto-ს ყველა ველს optional-ად
export class UpdateHeroSlideDto extends PartialType(CreateHeroSlideDto) {}
