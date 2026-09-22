import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Size } from './entities/size.entity';
import { ProductVariant } from '../products/entities/product-variant.entity';
import { Product } from '../products/entities/product.entity';
import { SizesController } from './sizes.controller';
import { SizesService } from './sizes.service';

@Module({
  // ProductVariant/Product აქაც გვჭირდება — remove()-ზე ზომის წაშლისას
  // CASCADE-ით წაშლილი ProductVariant row-ების საპირწონედ Product.stock-ის
  // ხელახლა გამოსათვლელად (ColorsModule-ის იგივე პატერნი).
  imports: [TypeOrmModule.forFeature([Size, ProductVariant, Product])],
  controllers: [SizesController],
  providers: [SizesService],
  exports: [SizesService],
})
export class SizesModule {}
