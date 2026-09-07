import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Attribute } from './entities/attribute.entity';
import { AttributeOption } from './entities/attribute-option.entity';
import { CategoryAttribute } from '../category/entities/category-attribute.entity';
import { ProductAttributeValue } from '../products/entities/product-attribute-value.entity';
import { AttributeController } from './attribute.controller';
import { AttributeService } from './attribute.service';

@Module({
  // CategoryAttribute/ProductAttributeValue აქაც გვჭირდება — remove()-ის
  // in-use შემოწმებისთვის (იხ. AttributeService.remove-ის კომენტარი).
  imports: [
    TypeOrmModule.forFeature([
      Attribute,
      AttributeOption,
      CategoryAttribute,
      ProductAttributeValue,
    ]),
  ],
  controllers: [AttributeController],
  providers: [AttributeService],
  exports: [AttributeService],
})
export class AttributeModule {}
