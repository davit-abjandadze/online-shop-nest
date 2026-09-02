import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Payment } from './entities/payment.entity';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { BogPaymentProvider } from './providers/bog-payment.provider';
import { MockPaymentProvider } from './providers/mock-payment.provider';
import { PAYMENT_PROVIDER } from './providers/payment-provider.interface';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [TypeOrmModule.forFeature([Payment]), HttpModule, OrdersModule],
  controllers: [PaymentsController],
  providers: [
    BogPaymentProvider,
    MockPaymentProvider,
    // PaymentsService PaymentProviderClient ინტერფეისზეა დამოკიდებული, არა
    // კონკრეტულ პროვაიდერზე. კომპანიის რეგისტრაციამდე PAYMENT_PROVIDER=mock
    // (default) — checkout ნაკადი მუშაობს რეალური BOG credentials-ის
    // გარეშე. რეგისტრაციის შემდეგ PAYMENT_PROVIDER=bog და BOG_* env
    // ცვლადები რეალურ API-ზე გადართავს კოდის ცვლილების გარეშე.
    {
      provide: PAYMENT_PROVIDER,
      useFactory: (
        configService: ConfigService,
        bog: BogPaymentProvider,
        mock: MockPaymentProvider,
      ) =>
        configService.get<string>('PAYMENT_PROVIDER') === 'bog' ? bog : mock,
      inject: [ConfigService, BogPaymentProvider, MockPaymentProvider],
    },
    PaymentsService,
  ],
})
export class PaymentsModule {}
