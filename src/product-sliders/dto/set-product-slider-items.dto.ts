import { IsArray, ArrayUnique, IsInt } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

// PUT /product-sliders/:id/items — bulk set (SetProductColorsDto-ს იგივე
// delete + recreate პატერნი, იხ. ProductSlidersService.setItems). მასივის
// თანმიმდევრობა განსაზღვრავს ჩვენების რიგს (sortOrder = index). ცარიელი
// მასივი ნიშნავს ბლოკიდან ყველა პროდუქტის მოხსნას.
export class SetProductSliderItemsDto {
  @ApiProperty({
    description: 'პროდუქტების ID-ები სასურველი რიგით',
    type: [Number],
    example: [3, 7, 12],
  })
  @IsArray()
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  productIds!: number[];
}
