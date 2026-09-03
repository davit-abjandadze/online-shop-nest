import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HeroSlide } from './entities/hero-slide.entity';
import { Product } from '../products/entities/product.entity';
import { HeroSlidesController } from './hero-slides.controller';
import { HeroSlidesService } from './hero-slides.service';

@Module({
  // Product ცალკე რეგისტრირდება (ProductsModule-ის სრული იმპორტის გარეშე) —
  // HeroSlidesService-ს Product-ის Repository სჭირდება მხოლოდ productId-ის
  // არსებობის დასამოწმებლად სლაიდის შექმნა/განახლებისას (category.module.ts-ის
  // იგივე პატერნი).
  imports: [TypeOrmModule.forFeature([HeroSlide, Product])],
  controllers: [HeroSlidesController],
  providers: [HeroSlidesService],
  exports: [HeroSlidesService],
})
export class HeroSlidesModule {}
