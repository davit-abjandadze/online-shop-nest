import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Color } from './entities/color.entity';
import { ProductColor } from '../products/entities/product-color.entity';
import { Product } from '../products/entities/product.entity';
import { ColorsController } from './colors.controller';
import { ColorsService } from './colors.service';

@Module({
  // ProductColor/Product აქაც გვჭირდება — remove()-ზე ფერის წაშლისას
  // CASCADE-ით წაშლილი ProductColor row-ების საპირწონედ Product.stock-ის
  // ხელახლა გამოსათვლელად (იხ. ColorsService.remove-ის კომენტარი).
  imports: [TypeOrmModule.forFeature([Color, ProductColor, Product])],
  controllers: [ColorsController],
  providers: [ColorsService],
  // ProductsModule-ს პირდაპირ Color entity სჭირდება (product-color
  // ვალიდაციისთვის) — CategoryModule-ის Attribute-ის იმპორტის იგივე
  // პატერნით, ცალკე ColorsModule-ის სრული იმპორტის გარეშე.
  exports: [ColorsService],
})
export class ColorsModule {}
