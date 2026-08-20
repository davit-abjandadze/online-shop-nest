import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { Payment } from './entities/payment.entity';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { BogPaymentProvider } from './providers/bog-payment.provider';
import { PAYMENT_PROVIDER } from './providers/payment-provider.interface';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [TypeOrmModule.forFeature([Payment]), HttpModule, OrdersModule],
  controllers: [PaymentsController],
  providers: [
    BogPaymentProvider,
    // PaymentsService PaymentProviderClient ინტერფეისზეა დამოკიდებული, არა
    // კონკრეტულ BogPaymentProvider კლასზე — TBC-ის (ან სხვა პროვაიდერის)
    // მომავალში დამატება მხოლოდ ამ provide-ის შეცვლას მოითხოვს.
    { provide: PAYMENT_PROVIDER, useExisting: BogPaymentProvider },
    PaymentsService,
  ],
})
export class PaymentsModule {}
