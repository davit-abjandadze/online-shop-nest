import { Order } from '../../orders/entities/order.entity';
import { PaymentProvider, PaymentStatus } from '../entities/payment.entity';

// DI ტოკენი — PaymentsService ამ ინტერფეისზეა დამოკიდებული, არა კონკრეტულ
// BogPaymentProvider კლასზე. TBC-ის (ან სხვა პროვაიდერის) დამატება მხოლოდ
// payments.module.ts-ში ახალი provide-ის რეგისტრაციას მოითხოვს.
export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

export interface PaymentProviderClient {
  // Payment.provider-ის შესავსებად — ადრე createPayment()-ის შედეგი Payment
  // row-ში provider-ის მითითების გარეშე ინახებოდა, ანუ სვეტი ყოველთვის
  // default (BOG) მნიშვნელობაზე რჩებოდა mock-გადახდებზეც კი.
  readonly provider: PaymentProvider;

  createPayment(
    order: Order,
  ): Promise<{ externalId: string; redirectUrl: string }>;

  // ვერიფიკაცია ხდება ნედლი (raw) body-ს ბაიტებზე, არა parse-ილ JSON-ზე —
  // ხელმოწერა ფილდების თანმიმდევრობაზეც არის დამოკიდებული.
  verifyCallback(rawBody: Buffer, headers: Record<string, string>): boolean;

  parseCallback(rawBody: Buffer): {
    externalId: string;
    status: PaymentStatus;
  };

  getStatus(externalId: string): Promise<PaymentStatus>;
}
