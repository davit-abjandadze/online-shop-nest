import { Module, Logger } from '@nestjs/common';
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
      ) => {
        const useBog = configService.get<string>('PAYMENT_PROVIDER') === 'bog';
        // MockPaymentProvider.verifyCallback() განზრახ ყოველთვის true-ს
        // აბრუნებს (კომპანიის რეგისტრაციამდე stub-ია — იხ. mock-payment.
        // provider.ts) — production-ში ამის დავიწყებით დატოვება public
        // /payments/callback/bog route-ს ნებისმიერი POST-ისთვის ღიად
        // ტოვებს. კოდის ცვლილება (bog-ზე იძულებითი გადართვა) აქ ნაადრევია,
        // სანამ კომპანია იურიდიულად არ დარეგისტრირდება — ამიტომ მხოლოდ
        // ხმამაღალი გაფრთხილება ეს, არა throw.
        if (!useBog && configService.get<string>('NODE_ENV') === 'production') {
          new Logger('PaymentsModule').warn(
            'PAYMENT_PROVIDER არ არის "bog" production-ში — MockPaymentProvider.verifyCallback() ' +
              'ყოველთვის true-ს აბრუნებს, callback route დაუცველია ნებისმიერი POST-ისგან. ' +
              'დარწმუნდით, ეს განზრახულია (კომპანიის რეგისტრაციამდე მოსალოდნელი მდგომარეობაა).',
          );
        }
        return useBog ? bog : mock;
      },
      inject: [ConfigService, BogPaymentProvider, MockPaymentProvider],
    },
    PaymentsService,
  ],
})
export class PaymentsModule {}
