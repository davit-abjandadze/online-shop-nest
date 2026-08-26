import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from './entities/category.entity';
import { CategoryAttribute } from './entities/category-attribute.entity';
import { Attribute } from '../attribute/entities/attribute.entity';
import { AttributeOption } from '../attribute/entities/attribute-option.entity';
import { Product } from '../products/entities/product.entity';
import { ProductAttributeValue } from '../products/entities/product-attribute-value.entity';
import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';

@Module({
  // Attribute/AttributeOption/Product/ProductAttributeValue აქაც
  // რეგისტრირდება (შესაბამისი მოდულების გარდა) — CategoryService-ს
  // საკუთარი repo-ები სჭირდება: Attribute — addAttributeToCategory-ში
  // არსებობის დასამოწმებლად (ფაზა 3), Product/ProductAttributeValue/
  // AttributeOption — ფაზა 5-ის filter/facet querybuilder-ისთვის.
  // ProductsModule/AttributeModule-ის სრული იმპორტის (და circular-dependency
  // რისკის) გარეშე.
  imports: [
    TypeOrmModule.forFeature([
      Category,
      CategoryAttribute,
      Attribute,
      AttributeOption,
      Product,
      ProductAttributeValue,
    ]),
  ],
  controllers: [CategoryController],
  providers: [CategoryService],
  exports: [CategoryService],
})
export class CategoryModule {}
