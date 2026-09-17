import { ApiProperty } from '@nestjs/swagger';

export class ProductStatDto {
  @ApiProperty({
    example: 42,
    nullable: true,
    description:
      'პროდუქტის ID — null, თუ პროდუქტი შემდგომში წაშლილია (snapshot productName მაინც ჩანს)',
  })
  productId!: number | null;

  @ApiProperty({ example: 'უსადენო ყურსასმენები' })
  productName!: string;

  @ApiProperty({ example: 87, description: 'გაყიდული ერთეულების ჯამი' })
  quantitySold!: number;

  @ApiProperty({
    example: 4350.5,
    description: 'ჯამური შემოსავალი ამ პროდუქტიდან',
  })
  revenue!: number;
}
