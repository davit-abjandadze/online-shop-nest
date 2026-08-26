import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from './entities/category.entity';
import { CategoryAttribute } from './entities/category-attribute.entity';
import { Attribute } from '../attribute/entities/attribute.entity';
import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';

@Module({
  // Attribute აქაც რეგისტრირდება (AttributeModule-ის გარდა) — CategoryService-ს
  // საკუთარი Repository<Attribute> სჭირდება addAttributeToCategory-ში
  // მხოლოდ არსებობის დასამოწმებლად, AttributeService-ის მთლიანი იმპორტის
  // (და მისი circular-dependency რისკის) გარეშე.
  imports: [
    TypeOrmModule.forFeature([Category, CategoryAttribute, Attribute]),
  ],
  controllers: [CategoryController],
  providers: [CategoryService],
  exports: [CategoryService],
})
export class CategoryModule {}
