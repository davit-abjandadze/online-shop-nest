import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { ProductAttributeValue } from './entities/product-attribute-value.entity';
import { ProductAdditionalInfo } from './entities/product-additional-info.entity';
import { ProductColor } from './entities/product-color.entity';
import { Color } from '../colors/entities/color.entity';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { CategoryModule } from '../category/category.module';

@Module({
  // CategoryModule იმპორტირებულია CategoryService-ის (findAttributesForCategory)
  // გამოსაყენებლად bulk attribute-value ვალიდაციისთვის — არცერთი მიმართულებით
  // ციკლური დამოკიდებულება არ იქმნება, CategoryModule ProductsModule-ს არ ეხება.
  // Color entity პირდაპირაა რეგისტრირებული (ColorsModule-ის სრული იმპორტის
  // გარეშე) — ProductsService-ს მხოლოდ setColors-ის colorId ვალიდაციისთვის
  // სჭირდება, CategoryModule-ის Attribute-ის იმპორტის იგივე პატერნით.
  imports: [
    TypeOrmModule.forFeature([
      Product,
      ProductAttributeValue,
      ProductAdditionalInfo,
      ProductColor,
      Color,
    ]),
    CategoryModule,
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
  // Cart/Orders მოდულებს ProductsService დასჭირდებათ მარაგის შემოწმება/დეკრემენტისთვის.
  exports: [ProductsService],
})
export class ProductsModule {}
