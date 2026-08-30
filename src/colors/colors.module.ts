import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Color } from './entities/color.entity';
import { ColorsController } from './colors.controller';
import { ColorsService } from './colors.service';

@Module({
  imports: [TypeOrmModule.forFeature([Color])],
  controllers: [ColorsController],
  providers: [ColorsService],
  // ProductsModule-ს პირდაპირ Color entity სჭირდება (product-color
  // ვალიდაციისთვის) — CategoryModule-ის Attribute-ის იმპორტის იგივე
  // პატერნით, ცალკე ColorsModule-ის სრული იმპორტის გარეშე.
  exports: [ColorsService],
})
export class ColorsModule {}
