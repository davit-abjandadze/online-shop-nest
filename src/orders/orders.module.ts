import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { CartModule } from '../cart/cart.module';
import { ProductsModule } from '../products/products.module';
import { BranchesModule } from '../branches/branches.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem]),
    CartModule,
    ProductsModule,
    BranchesModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  // Payments მოდულს OrdersService დასჭირდება გადახდის callback-ზე
  // შეკვეთის სტატუსის განახლებისთვის (Phase 4).
  exports: [OrdersService],
})
export class OrdersModule {}
