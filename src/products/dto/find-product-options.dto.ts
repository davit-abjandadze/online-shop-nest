import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

// ერთ მოთხოვნაში ამდენზე მეტი id არ მიიღება — public, rate limit-ის გარეშე
// endpoint-ია (findSimilar-ის limit-ის იგივე მიზეზით).
export const MAX_PRODUCT_OPTIONS_IDS = 100;

// `?ids=1,2,3` (ან `?ids=1&ids=2`) → [1, 2, 3]. არარიცხვითი ელემენტი NaN-ად
// რჩება, რომ @IsInt-მა 400 დააბრუნოს და ჩუმად არ გამოტოვოს.
const toIdArray = ({ value }: { value: unknown }) => {
  const parts: unknown[] = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];
  return parts
    .map((part) => String(part).trim())
    .filter((part) => part !== '')
    .map(Number);
};

export class FindProductOptionsDto {
  @ApiProperty({
    description: `პროდუქტების id-ები მძიმით გამოყოფილი (მაქს. ${MAX_PRODUCT_OPTIONS_IDS})`,
    example: '1,2,3',
    type: String,
  })
  @Transform(toIdArray)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_PRODUCT_OPTIONS_IDS)
  @IsInt({ each: true })
  @Min(1, { each: true })
  ids!: number[];
}
