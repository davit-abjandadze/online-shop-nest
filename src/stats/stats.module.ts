import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { Product } from '../products/entities/product.entity';
import { User } from '../users/entities/user.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Branch } from '../branches/entities/branch.entity';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

// StatsService repositories პირდაპირ იღებს (@InjectRepository) — არ
// უნდა importირდეს OrdersModule/ProductsModule/UsersModule/PaymentsModule,
// რომ სუფთა, read-only აგრეგაციის ფენად დარჩეს ბიზნეს-მოდულებისგან
// დამოუკიდებლად (იხ. STATS_PLAN.md).
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      OrderItem,
      Product,
      User,
      Payment,
      Branch,
    ]),
  ],
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
