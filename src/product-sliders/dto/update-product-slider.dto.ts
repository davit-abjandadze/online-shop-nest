import { PartialType } from '@nestjs/swagger';
import { CreateProductSliderDto } from './create-product-slider.dto';

// PartialType ავტომატურად ხდის CreateProductSliderDto-ს ყველა ველს
// optional-ად (productIds-ის ჩათვლით — თუ გამოგზავნილია, items მთლიანად
// ანაცვლდება, hero-slides/UpdateHeroSlideDto-ს იგივე პატერნი).
export class UpdateProductSliderDto extends PartialType(
  CreateProductSliderDto,
) {}
