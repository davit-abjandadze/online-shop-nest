import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderStatusHistory } from './entities/order-status-history.entity';
import { Payment } from '../payments/entities/payment.entity';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { CartModule } from '../cart/cart.module';
import { ProductsModule } from '../products/products.module';
import { BranchesModule } from '../branches/branches.module';

@Module({
  imports: [
    // Payment ცალკე მოდულს (PaymentsModule) ეკუთვნის, მაგრამ PaymentsModule
    // თავადვე OrdersModule-ს იმპორტავს (callback-ზე შეკვეთის სტატუსის
    // განახლებისთვის) — PaymentsService-ის აქ იმპორტი წრიულ დამოკიდებულებას
    // შექმნიდა, ამიტომ OrdersService მხოლოდ Payment repository-ს იღებს
    // (PAID→CANCELLED-ზე refund-flag-ის დასასმელად, იხ. updateStatus).
    TypeOrmModule.forFeature([Order, OrderItem, OrderStatusHistory, Payment]),
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
