import {
  Injectable,
  Inject,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentStatus } from './entities/payment.entity';
import { PAYMENT_PROVIDER } from './providers/payment-provider.interface';
import type { PaymentProviderClient } from './providers/payment-provider.interface';
import { OrdersService } from '../orders/orders.service';
import { OrderStatus } from '../orders/entities/order.entity';
import { UserRole } from '../users/entities/user.entity';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @Inject(PAYMENT_PROVIDER)
    private readonly provider: PaymentProviderClient,
    private readonly ordersService: OrdersService,
  ) {}

  // საკუთარი (ან ადმინის) PENDING შეკვეთისთვის BOG გადახდის დაწყება.
  async initiate(
    userId: number,
    role: UserRole,
    orderId: number,
  ): Promise<{ redirectUrl: string }> {
    const order = await this.ordersService.findOneForUser(
      userId,
      role,
      orderId,
    );

    if (order.status !== OrderStatus.PENDING) {
      // ან უკვე გადახდილია (ორმაგი დარიცხვისგან დაცვა), ან სხვა საბოლოო
      // სტატუსშია (CANCELLED/EXPIRED) — არც ერთ შემთხვევაში აღარ იწყება.
      throw new BadRequestException(
        'გადახდის დაწყება შესაძლებელია მხოლოდ გადაუხდელი (PENDING) შეკვეთისთვის',
      );
    }

    const { externalId, redirectUrl } =
      await this.provider.createPayment(order);

    const payment = this.paymentRepository.create({
      order,
      providerOrderId: externalId,
      status: PaymentStatus.CREATED,
    });
    await this.paymentRepository.save(payment);

    return { redirectUrl };
  }

  // BOG-ის callback-ის დამუშავება. იდემპოტენტურია — BOG-ს ჩვეულებრივი
  // ქცევაა ერთი და იმავე callback-ის განმეორებითი გაგზავნა (ქსელური retry),
  // ამიტომ უკვე COMPLETED Payment-ზე მეორედ არაფერს ვცვლით.
  async handleCallback(
    rawBody: Buffer,
    headers: Record<string, string>,
  ): Promise<void> {
    const isValid = this.provider.verifyCallback(rawBody, headers);
    if (!isValid) {
      throw new ForbiddenException('callback ხელმოწერის ვერიფიკაცია ჩავარდა');
    }

    const { externalId, status } = this.provider.parseCallback(rawBody);

    const payment = await this.paymentRepository.findOne({
      where: { providerOrderId: externalId },
      relations: { order: true },
    });
    if (!payment) {
      throw new NotFoundException(
        `Payment providerOrderId-ით ${externalId} ვერ მოიძებნა`,
      );
    }

    if (payment.status === PaymentStatus.COMPLETED) {
      this.logger.log(
        `Payment ${payment.id}: დუბლირებული callback COMPLETED სტატუსზე — იგნორირებულია`,
      );
      return;
    }

    payment.status = status;
    payment.rawCallbackPayload = JSON.parse(rawBody.toString('utf8')) as Record<
      string,
      unknown
    >;
    await this.paymentRepository.save(payment);

    if (status === PaymentStatus.COMPLETED) {
      await this.ordersService.updateStatus(payment.order.id, OrderStatus.PAID);
    }
    // REJECTED-ზე შეკვეთას PENDING-ად ვტოვებთ, რომ მომხმარებელმა ხელახლა
    // სცადოს გადახდა — refund/cancel-ის ცალკე ნაკადი out-of-scope-ია v1-ში.
  }
}
