import { ConfigService } from '@nestjs/config';
import { PaymentMethod } from '../orders/entities/order.entity';

export interface BankTransferDetails {
  recipient: string;
  iban: string;
  bankName: string | null;
}

export interface PaymentMethodsConfig {
  methods: PaymentMethod[];
  bankTransfer: BankTransferDetails | null;
}

const ALL_METHODS = Object.values(PaymentMethod);

// ხელმისაწვდომი გადახდის მეთოდები — PAYMENT_METHODS env (მძიმით გამოყოფილი,
// მაგ. "cash_on_delivery,bank_transfer"). ცარიელი/არარსებული = ყველა მეთოდი.
// ბანკის credential-ების მიღებამდე production-ში "card" უბრალოდ არ ჩაიწერება.
// bank_transfer მხოლოდ მაშინ ჩაირთვება, თუ BANK_TRANSFER_IBAN და
// BANK_TRANSFER_RECIPIENT შევსებულია — თორემ მომხმარებელს გადასარიცხი
// რეკვიზიტები ვერ ეჩვენება.
export function getPaymentMethodsConfig(
  configService: ConfigService,
): PaymentMethodsConfig {
  const raw = configService.get<string>('PAYMENT_METHODS')?.trim();
  const requested = raw
    ? raw
        .split(',')
        .map((m) => m.trim())
        .filter((m): m is PaymentMethod =>
          ALL_METHODS.includes(m as PaymentMethod),
        )
    : ALL_METHODS;

  const iban = configService.get<string>('BANK_TRANSFER_IBAN')?.trim();
  const recipient = configService
    .get<string>('BANK_TRANSFER_RECIPIENT')
    ?.trim();
  const bankTransfer =
    iban && recipient
      ? {
          iban,
          recipient,
          bankName:
            configService.get<string>('BANK_TRANSFER_BANK_NAME')?.trim() ||
            null,
        }
      : null;

  const methods = [...new Set(requested)].filter(
    (m) => m !== PaymentMethod.BANK_TRANSFER || bankTransfer,
  );

  return {
    methods,
    bankTransfer: methods.includes(PaymentMethod.BANK_TRANSFER)
      ? bankTransfer
      : null,
  };
}
