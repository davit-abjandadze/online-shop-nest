import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { createVerify } from 'crypto';
import { Order } from '../../orders/entities/order.entity';
import { PaymentStatus } from '../entities/payment.entity';
import { PaymentProviderClient } from './payment-provider.interface';

// BOG-ის callback-ის ველების ის ნაწილი, რასაც ეს provider ფაქტობრივად კითხულობს
// — დანარჩენი ველები (zoned_request_time და სხვ.) აქ არაა საჭირო.
interface BogCallbackPayload {
  body?: {
    order_status?: { key?: string };
    order_id?: string;
    id?: string;
  };
}

// BOG-ის `order_status.key` -> ჩვენი PaymentStatus. completed/rejected/
// refunded-ს პირდაპირ ვასახავთ; შუალედური (created/processing/auth_requested/
// blocked/refund_requested) ერთიანად PROCESSING-ია v1-ისთვის.
const STATUS_MAP: Record<string, PaymentStatus> = {
  created: PaymentStatus.CREATED,
  processing: PaymentStatus.PROCESSING,
  auth_requested: PaymentStatus.PROCESSING,
  blocked: PaymentStatus.PROCESSING,
  refund_requested: PaymentStatus.PROCESSING,
  completed: PaymentStatus.COMPLETED,
  partial_completed: PaymentStatus.PARTIAL_COMPLETED,
  rejected: PaymentStatus.REJECTED,
  refunded: PaymentStatus.REFUNDED,
  refunded_partially: PaymentStatus.PARTIAL_COMPLETED,
};

@Injectable()
export class BogPaymentProvider implements PaymentProviderClient {
  private readonly logger = new Logger(BogPaymentProvider.name);
  private readonly baseUrl: string;
  private readonly authUrl =
    'https://oauth2.bog.ge/auth/realms/bog/protocol/openid-connect/token';

  // მარტივი in-memory ქეში v1-ისთვის — Redis არაა საჭირო ერთი instance-ისთვის.
  private cachedToken: { token: string; expiresAt: number } | null = null;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl =
      this.configService.get<string>('BOG_BASE_URL') ?? 'https://api.bog.ge';
  }

  private async getAccessToken(): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now()) {
      return this.cachedToken.token;
    }

    const clientId = this.configService.get<string>('BOG_CLIENT_ID');
    const clientSecret = this.configService.get<string>('BOG_CLIENT_SECRET');
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const response = await firstValueFrom(
      this.httpService.post<{ access_token: string; expires_in: number }>(
        this.authUrl,
        'grant_type=client_credentials',
        {
          headers: {
            Authorization: `Basic ${basic}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      ),
    );

    const { access_token, expires_in } = response.data;
    // 30წმ ბუფერი ვადის დასრულებამდე — ქსელური latency-ის დასაფარად, რომ
    // ვადაგასული token-ით მოთხოვნა არ გავუშვათ.
    this.cachedToken = {
      token: access_token,
      expiresAt: Date.now() + (expires_in - 30) * 1000,
    };
    return access_token;
  }

  async createPayment(
    order: Order,
  ): Promise<{ externalId: string; redirectUrl: string }> {
    const token = await this.getAccessToken();
    const callbackUrl = this.configService.get<string>('BOG_CALLBACK_URL');
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');

    const body = {
      callback_url: callbackUrl,
      external_order_id: String(order.id),
      purchase_units: {
        currency: order.currency || 'GEL',
        total_amount: Number(order.totalAmount),
        basket: order.items.map((item) => ({
          quantity: item.quantity,
          unit_price: Number(item.unitPrice),
          product_id: String(item.product?.id ?? item.id),
        })),
      },
      redirect_urls: {
        success: `${frontendUrl}/orders/${order.id}?payment=success`,
        fail: `${frontendUrl}/orders/${order.id}?payment=fail`,
      },
      ttl: 15,
      payment_method: ['card'],
    };

    const response = await firstValueFrom(
      this.httpService.post<{
        id: string;
        _links: { redirect: { href: string } };
      }>(`${this.baseUrl}/payments/v1/ecommerce/orders`, body, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );

    return {
      externalId: response.data.id,
      redirectUrl: response.data._links.redirect.href,
    };
  }

  verifyCallback(rawBody: Buffer, headers: Record<string, string>): boolean {
    const signature = headers['callback-signature'];
    if (!signature) {
      return false;
    }

    const publicKey = this.getPublicKey();
    if (!publicKey) {
      this.logger.error(
        'BOG_PUBLIC_KEY არაა კონფიგურირებული — callback-ის ვერიფიკაცია შეუძლებელია',
      );
      return false;
    }

    try {
      const verifier = createVerify('RSA-SHA256');
      // ხელმოწერა ზუსტად ნედლ (raw) body-ს ბაიტებზეა აღებული — არა ხელახლა
      // serialize-ილ JSON ობიექტზე, ველების თანმიმდევრობა ჰეშზე მოქმედებს.
      verifier.update(rawBody);
      verifier.end();
      return verifier.verify(publicKey, signature, 'base64');
    } catch (err) {
      this.logger.error('Callback ხელმოწერის ვერიფიკაცია ჩავარდა', err);
      return false;
    }
  }

  parseCallback(rawBody: Buffer): {
    externalId: string;
    status: PaymentStatus;
  } {
    const payload = JSON.parse(rawBody.toString('utf8')) as BogCallbackPayload;
    const statusKey = payload.body?.order_status?.key;
    // შენიშვნა (Phase 0-ის დაუდასტურებელი ფაქტი): callback body-ში BOG-ის
    // provider-order id-ის ზუსტი ველის სახელი დოკუმენტაციაში არაა ცალსახად
    // ნაჩვენები — რეალურ sandbox callback-ზე გადამოწმებამდე ორივე
    // სავარაუდო ვარიანტს ვცდით.
    const externalId = payload.body?.order_id ?? payload.body?.id ?? '';
    return {
      externalId,
      status: statusKey
        ? (STATUS_MAP[statusKey] ?? PaymentStatus.PROCESSING)
        : PaymentStatus.PROCESSING,
    };
  }

  async getStatus(externalId: string): Promise<PaymentStatus> {
    const token = await this.getAccessToken();
    const response = await firstValueFrom(
      this.httpService.get<{ order_status?: { key: string } }>(
        `${this.baseUrl}/payments/v1/receipt/${externalId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      ),
    );
    const statusKey = response.data?.order_status?.key;
    return statusKey
      ? (STATUS_MAP[statusKey] ?? PaymentStatus.PROCESSING)
      : PaymentStatus.PROCESSING;
  }

  private getPublicKey(): string | undefined {
    const inline = this.configService.get<string>('BOG_PUBLIC_KEY');
    if (!inline) {
      return undefined;
    }
    // .env-ში PEM-ს ერთ ხაზზე გამოტანილი \n-ებით ვინახავთ — რეალურ ახალ
    // ხაზებად გარდაქმნა საჭიროა, რომ crypto-მ სწორად წაიკითხოს.
    return inline.replace(/\\n/g, '\n');
  }
}
