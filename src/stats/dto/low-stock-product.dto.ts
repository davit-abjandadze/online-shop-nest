import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type LowStockItemType = 'color' | 'variant';

// პროდუქტის ფერი/ზომა (ProductColor ან ProductVariant), რომლის მარაგიც
// threshold-ზე ნაკლები ან ტოლია — product.stock ფერების/ვარიანტების ჯამია,
// ამიტომ ცალკეული ამოწურული ფერი/ზომა მხოლოდ ჯამით ვერ გამოჩნდებოდა.
export class LowStockItemDto {
  @ApiProperty({ enum: ['color', 'variant'], example: 'variant' })
  type!: LowStockItemType;

  @ApiProperty({
    example: 'b3c1f7e2-...',
    description: 'ProductColor/ProductVariant id',
  })
  id!: string;

  @ApiPropertyOptional({
    description:
      'ფერი (translations + hexCode) — null, თუ ვარიანტს ფერი არ აქვს',
    nullable: true,
  })
  color!: { id: string; translations: unknown; hexCode?: string } | null;

  @ApiPropertyOptional({
    description:
      'ზომა (translations + code) — null ფერისთვის ან ზომის არმქონე ვარიანტისთვის',
    nullable: true,
  })
  size!: { id: string; translations: unknown; code: string } | null;

  @ApiProperty({ example: 1 })
  stock!: number;
}
