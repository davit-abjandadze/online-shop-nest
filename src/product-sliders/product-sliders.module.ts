import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductSlider } from './entities/product-slider.entity';
import { ProductSliderItem } from './entities/product-slider-item.entity';
import { Product } from '../products/entities/product.entity';
import { ProductSlidersController } from './product-sliders.controller';
import { ProductSlidersService } from './product-sliders.service';

@Module({
  // Product ცალკე რეგისტრირდება (ProductsModule-ის სრული იმპორტის გარეშე) —
  // ProductSlidersService-ს Product-ის Repository სჭირდება მხოლოდ
  // productIds-ის არსებობის დასამოწმებლად items-ის set-ისას
  // (hero-slides.module.ts-ის იგივე პატერნი).
  imports: [
    TypeOrmModule.forFeature([ProductSlider, ProductSliderItem, Product]),
  ],
  controllers: [ProductSlidersController],
  providers: [ProductSlidersService],
  exports: [ProductSlidersService],
})
export class ProductSlidersModule {}
