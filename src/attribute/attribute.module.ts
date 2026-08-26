import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Attribute } from './entities/attribute.entity';
import { AttributeOption } from './entities/attribute-option.entity';
import { AttributeController } from './attribute.controller';
import { AttributeService } from './attribute.service';

@Module({
  imports: [TypeOrmModule.forFeature([Attribute, AttributeOption])],
  controllers: [AttributeController],
  providers: [AttributeService],
  exports: [AttributeService],
})
export class AttributeModule {}
