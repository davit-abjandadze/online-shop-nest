import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { Order } from '../../orders/entities/order.entity';
import { PaymentStatus } from '../entities/payment.entity';
import { PaymentProviderClient } from './payment-provider.interface';

// კომპანიის იურიდიულ რეგისტრაციამდე გამოსაყენებელი stub — რეალურ BOG API-ს
// საერთოდ არ ეხება. redirectUrl-ზე გადასვლა (ან პირდაპირი GET) დაუყოვნებლივ
// ასრულებს "გადახდას" PaymentsController-ის /payments/mock/:externalId/complete
// route-ის საშუალებით, რომ checkout ნაკადი ბოლომდე შემოწმებადი იყოს რეალური
// ხელშეკრულების/production credentials-ის გარეშე. გადართვა mock-სა და
// რეალურ BogPaymentProvider-ს შორის PAYMENT_PROVIDER env ცვლადით ხდება
// (იხ. payments.module.ts) — კომპანიის რეგისტრაციის შემდეგ უბრალოდ
// PAYMENT_PROVIDER=bog და შესაბამისი BOG_* credentials კმარა.
@Injectable()
export class MockPaymentProvider implements PaymentProviderClient {
  private readonly logger = new Logger(MockPaymentProvider.name);

  constructor(private readonly configService: ConfigService) {
    this.logger.warn(
      'PAYMENT_PROVIDER=mock — გადახდები ხელოვნურად სრულდება, რეალურ BOG API-ს არ ვეხებით',
    );
  }

  createPayment(
    order: Order,
  ): Promise<{ externalId: string; redirectUrl: string }> {
    const externalId = `mock-${randomUUID()}`;
    const backendUrl =
      this.configService.get<string>('BACKEND_URL') ?? 'http://localhost:5000';
    // რეალურ BOG-თან redirectUrl ბანკის checkout გვერდზეა — mock-ში ეს
    // ბექენდის საკუთარი "auto-complete" route-ია, GET-ზე დაუყოვნებლივ
    // ასრულებს გადახდას და frontend success/fail გვერდზე გადამისამართებს,
    // ისევე როგორც რეალური BOG callback-ისა და redirect-ის კომბინაცია.
    return Promise.resolve({
      externalId,
      redirectUrl: `${backendUrl}/payments/mock/${externalId}/complete?orderId=${order.id}`,
    });
  }

  verifyCallback(): boolean {
    // mock callback-ს რეალური ხელმოწერა არ გააჩნია — დაცვა /payments/mock/...
    // route-ის დონეზეა (მხოლოდ PAYMENT_PROVIDER=mock-ზეა ჩართული).
    return true;
  }

  parseCallback(rawBody: Buffer): {
    externalId: string;
    status: PaymentStatus;
  } {
    return JSON.parse(rawBody.toString('utf8')) as {
      externalId: string;
      status: PaymentStatus;
    };
  }

  getStatus(): Promise<PaymentStatus> {
    // mock-ში სტატუსის ცალკე გამოკითხვა არ სჭირდება — /complete route-ის
    // გავლისთანავე Payment-ს პირდაპირ COMPLETED-ზე ვაყენებთ handleCallback-ით.
    return Promise.resolve(PaymentStatus.COMPLETED);
  }
}
