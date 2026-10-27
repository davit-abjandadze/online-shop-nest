import { ConfigService } from '@nestjs/config';
import { getPaymentMethodsConfig } from './payment-methods.util';
import { PaymentMethod } from '../orders/entities/order.entity';

const config = (env: Record<string, string | undefined>) =>
  ({ get: (key: string) => env[key] }) as unknown as ConfigService;

const BANK_ENV = {
  BANK_TRANSFER_IBAN: 'GE00BG0000000000000000',
  BANK_TRANSFER_RECIPIENT: 'ი/მ ტესტი',
};

describe('getPaymentMethodsConfig', () => {
  it('PAYMENT_METHODS-ის გარეშე ყველა მეთოდს რთავს (რეკვიზიტების არსებობისას)', () => {
    const result = getPaymentMethodsConfig(config(BANK_ENV));

    expect(result.methods).toEqual([
      PaymentMethod.CARD,
      PaymentMethod.CASH_ON_DELIVERY,
      PaymentMethod.BANK_TRANSFER,
    ]);
    expect(result.bankTransfer).toEqual({
      iban: BANK_ENV.BANK_TRANSFER_IBAN,
      recipient: BANK_ENV.BANK_TRANSFER_RECIPIENT,
      bankName: null,
    });
  });

  it('მხოლოდ ჩამოთვლილ (და ვალიდურ) მეთოდებს ტოვებს', () => {
    const result = getPaymentMethodsConfig(
      config({
        ...BANK_ENV,
        PAYMENT_METHODS: ' cash_on_delivery , bitcoin,bank_transfer',
      }),
    );

    expect(result.methods).toEqual([
      PaymentMethod.CASH_ON_DELIVERY,
      PaymentMethod.BANK_TRANSFER,
    ]);
  });

  it('IBAN-ის/მიმღების გარეშე bank_transfer-ს თიშავს', () => {
    const result = getPaymentMethodsConfig(
      config({
        PAYMENT_METHODS: 'cash_on_delivery,bank_transfer',
        BANK_TRANSFER_IBAN: 'GE00BG0000000000000000',
      }),
    );

    expect(result.methods).toEqual([PaymentMethod.CASH_ON_DELIVERY]);
    expect(result.bankTransfer).toBeNull();
  });

  it('გამორთული bank_transfer-ის რეკვიზიტებს არ აბრუნებს', () => {
    const result = getPaymentMethodsConfig(
      config({ ...BANK_ENV, PAYMENT_METHODS: 'card' }),
    );

    expect(result.methods).toEqual([PaymentMethod.CARD]);
    expect(result.bankTransfer).toBeNull();
  });
});
