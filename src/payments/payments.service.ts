import {
  Injectable,
  Inject,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Payment, PaymentStatus } from './entities/payment.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { PAYMENT_PROVIDER } from './providers/payment-provider.interface';
import type { PaymentProviderClient } from './providers/payment-provider.interface';
import { OrdersService } from '../orders/orders.service';
import { OrderStatus } from '../orders/entities/order.entity';
import { UserRole } from '../users/entities/user.entity';

// checkout-ის სიცოცხლე — BogPaymentProvider.createPayment-ის `ttl: 15`-ს
// უნდა ემთხვეოდეს.
const CHECKOUT_TTL_MS = 15 * 60 * 1000;
// არსებული checkout-ის ხელახლა გამოყენება მხოლოდ თუ ამდენზე მეტი დრო რჩება —
// თორემ მომხმარებელი ბანკის გვერდზე გადახდის დასრულებას ვერ მოასწრებს.
const CHECKOUT_REUSE_MIN_MS = 2 * 60 * 1000;
// შეკვეთა checkout-ის დასრულების შემდეგ კიდევ ამდენ ხანს ცოცხლობს, რომ
// ბოლო წამზე შესრულებული გადახდის callback-მა მოასწროს.
const ORDER_EXPIRY_GRACE_MS = 2 * 60 * 1000;
// შეკვეთის მაქსიმალური სიცოცხლე შექმნიდან — ამის შემდეგ ახალი checkout
// აღარ იქმნება (მარაგის უსასრულოდ დაკავებისგან დაცვა).
const MAX_ORDER_LIFETIME_MS = 60 * 60 * 1000;

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectDataSource()
    private dataSource: DataSource,
    @Inject(PAYMENT_PROVIDER)
    private readonly provider: PaymentProviderClient,
    private readonly ordersService: OrdersService,
  ) {}

  // საკუთარი (ან ადმინის) PENDING შეკვეთისთვის BOG გადახდის დაწყება.
  //
  // ორდერის row pessimistic_write ლოქის ქვეშაა (ტრანზაქციაში) provider-ის
  // გამოძახებიდან Payment-ის შენახვამდე — ორი პარალელური initiate ერთ და
  // იმავე ორდერზე (ორმაგი დაწკაპუნება, retry, ორი ტაბი) ერთდროულად ვეღარ
  // მიმართავს BOG API-ს: მეორე ცდილობს ლოქის აღებას მხოლოდ პირველის commit-ის
  // შემდეგ, პასუხობს "PENDING აღარ არის" (თუ პირველმა უკვე შეცვალა) ან
  // ჩვეულებრივად ანახლებს იმავე Payment row-ს (თუ ჯერ PENDING-ია). ასე
  // აღარ რჩება "BOG-თან წარმატებული, ლოკალურად დაუკავშირებელი" checkout
  // link, რომელსაც callback ვერ დაუკავშირდება.
  async initiate(
    userId: number,
    role: UserRole,
    orderId: number,
  ): Promise<{ redirectUrl: string }> {
    // საკუთრების შემოწმება ლოქის გარეთ — findOneForUser 404/403-ს
    // ტრანზაქციამდე აგდებს.
    await this.ordersService.findOneForUser(userId, role, orderId);

    return this.dataSource.transaction(async (manager) => {
      // ⚠️ ფიქსი: Postgres-ს FOR UPDATE-ის leftJoinAndSelect('items.product')-თან
      // ერთად გაშვება არ სჩვევია — "FOR UPDATE cannot be applied to the
      // nullable side of an outer join" (item.product ნელაბლ-ია, იხ.
      // OrderItem.product). ლოქი მხოლოდ order-row-ს სჭირდება (ორი პარალელური
      // initiate-ის სერიალიზაციისთვის) — items/product უბრალო, ლოქის გარეშე
      // read-ითაა ცალკე ჩატვირთული ქვემოთ.
      const lockedOrder = await manager
        .createQueryBuilder(Order, 'order')
        .setLock('pessimistic_write')
        .where('order.id = :id', { id: orderId })
        .getOne();

      if (!lockedOrder || lockedOrder.status !== OrderStatus.PENDING) {
        // ან უკვე გადახდილია (ორმაგი დარიცხვისგან დაცვა), ან სხვა საბოლოო
        // სტატუსშია (CANCELLED/EXPIRED) — არც ერთ შემთხვევაში აღარ იწყება.
        throw new BadRequestException(
          'გადახდის დაწყება შესაძლებელია მხოლოდ გადაუხდელი (PENDING) შეკვეთისთვის',
        );
      }

      lockedOrder.items = await manager.find(OrderItem, {
        where: { order: { id: orderId } },
        relations: { product: true },
      });

      // Payment.order არის OneToOne + UNIQUE(orderId) — ხელახალი initiate
      // (მაგ. მომხმარებელმა redirect გვერდი დახურა და თავიდან სცადა) არსებულ
      // Payment-ს განაახლებს ახალი provider-order-ით ახალი row-ის შექმნის
      // ნაცვლად, თორემ UNIQUE constraint-ზე დაირღვევა (500) — ეს
      // შესაბამისობაშია Payment entity-ის კომენტართან: "ერთ შეკვეთას —
      // ერთი გადახდა".
      const paymentRepo = manager.getRepository(Payment);
      let payment = await paymentRepo.findOne({
        where: { order: { id: lockedOrder.id } },
      });

      const now = Date.now();

      // ჯერ კიდევ ცოცხალი checkout (ორი ტაბი, "უკან" და ხელახლა ცდა) —
      // იმავე ბმულს ვაბრუნებთ. ახლის შექმნა providerOrderId-ს გადაწერდა და
      // ძველ გვერდზე გადახდილი თანხის callback 404-ს მიიღებდა: ფული
      // ჩამოჭრილია, შეკვეთა კი გადაუხდელი რჩება.
      if (
        payment?.redirectUrl &&
        payment.checkoutExpiresAt &&
        (payment.status === PaymentStatus.CREATED ||
          payment.status === PaymentStatus.PROCESSING) &&
        payment.checkoutExpiresAt.getTime() - now > CHECKOUT_REUSE_MIN_MS
      ) {
        return { redirectUrl: payment.redirectUrl };
      }

      // შეკვეთა checkout-ის ვადის (BOG ttl) ბოლომდე + მცირე მარაგით უნდა
      // იცოცხლოს — აქამდე expiresAt შექმნიდან 15 წუთს ითვლიდა, BOG-ის ttl კი
      // initiate-იდან, ანუ მე-14 წუთზე დაწყებული და მე-16-ზე დასრულებული
      // გადახდა უკვე ვადაგასულ (მარაგდაბრუნებულ) შეკვეთაზე მოდიოდა.
      // მაქსიმალური სიცოცხლე შეზღუდულია, რომ განმეორებითი initiate-ით
      // მარაგი უსასრულოდ ვერ დაიკავონ.
      const checkoutExpiresAt = new Date(now + CHECKOUT_TTL_MS);
      const requiredOrderExpiry = new Date(
        checkoutExpiresAt.getTime() + ORDER_EXPIRY_GRACE_MS,
      );
      if (
        (lockedOrder.expiresAt && lockedOrder.expiresAt.getTime() <= now) ||
        requiredOrderExpiry.getTime() >
          lockedOrder.createdAt.getTime() + MAX_ORDER_LIFETIME_MS
      ) {
        throw new BadRequestException(
          'შეკვეთის ვადა იწურება — გთხოვთ, გააფორმოთ შეკვეთა ხელახლა',
        );
      }

      const { externalId, redirectUrl } =
        await this.provider.createPayment(lockedOrder);

      if (payment) {
        payment.provider = this.provider.provider;
        payment.providerOrderId = externalId;
        payment.status = PaymentStatus.CREATED;
        payment.rawCallbackPayload = undefined;
      } else {
        payment = paymentRepo.create({
          order: lockedOrder,
          provider: this.provider.provider,
          providerOrderId: externalId,
          status: PaymentStatus.CREATED,
        });
      }
      payment.redirectUrl = redirectUrl;
      payment.checkoutExpiresAt = checkoutExpiresAt;
      await paymentRepo.save(payment);

      if (
        !lockedOrder.expiresAt ||
        lockedOrder.expiresAt.getTime() < requiredOrderExpiry.getTime()
      ) {
        await manager.update(Order, lockedOrder.id, {
          expiresAt: requiredOrderExpiry,
        });
      }

      return { redirectUrl };
    });
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
    const rawPayload = JSON.parse(rawBody.toString('utf8')) as Record<
      string,
      unknown
    >;

    const found = await this.paymentRepository.findOne({
      where: { providerOrderId: externalId },
      relations: { order: true },
    });
    if (!found) {
      throw new NotFoundException(
        `Payment providerOrderId-ით ${externalId} ვერ მოიძებნა`,
      );
    }
    const orderId = found.order.id;

    // Payment-ის სტატუსი და შეკვეთის PAID-ზე გადასვლა ერთ ტრანზაქციაშია.
    // აქამდე Payment ჯერ COMPLETED-ად ინახებოდა, შეკვეთა კი ცალკე იცვლებოდა
    // — თუ მეორე ნაბიჯი ჩავარდებოდა, BOG-ის retry "უკვე COMPLETED"-ს ხედავდა
    // და აღარაფერს აკეთებდა: ფული ჩამოჭრილია, შეკვეთა გადაუხდელი რჩება
    // (და cron-ი მას EXPIRED-ად აქცევდა). ახლა ჩავარდნისას ორივე უკან
    // ბრუნდება და retry თავიდან ცდის.
    //
    // ლოქების თანმიმდევრობა: ჯერ order, მერე payment — იგივე, რაც
    // initiate/updateStatus-ში, რომ deadlock არ მოხდეს.
    await this.dataSource.transaction(async (manager) => {
      await manager
        .createQueryBuilder(Order, 'order')
        .setLock('pessimistic_write')
        .where('order.id = :id', { id: orderId })
        .getOne();
      const payment = await manager
        .createQueryBuilder(Payment, 'payment')
        .setLock('pessimistic_write')
        .where('payment.id = :id', { id: found.id })
        .getOne();
      if (!payment) {
        throw new NotFoundException(`Payment ${found.id} ვერ მოიძებნა`);
      }

      if (payment.status === PaymentStatus.COMPLETED) {
        this.logger.log(
          `Payment ${payment.id}: დუბლირებული callback COMPLETED სტატუსზე — იგნორირებულია`,
        );
        return;
      }

      payment.status = status;
      payment.rawCallbackPayload = rawPayload;

      if (status === PaymentStatus.COMPLETED) {
        // onlyFrom: PENDING — თუ შეკვეთა ლოქის ქვეშ უკვე EXPIRED/CANCELLED-ია,
        // მარაგი დაბრუნებულია და შესაძლოა სხვამ დაიკავა; PAID-ზე ბრმად
        // გადაყვანა overselling იქნებოდა. Payment მაინც COMPLETED ინახება
        // (თანხა მიღებულია) და ხელით შემოწმებისთვის ვაფიქსირებთ.
        const { changed, previousStatus } =
          await this.ordersService.transitionStatusInTransaction(
            manager,
            orderId,
            OrderStatus.PAID,
            { onlyFrom: [OrderStatus.PENDING] },
          );
        if (
          !changed &&
          (previousStatus === OrderStatus.EXPIRED ||
            previousStatus === OrderStatus.CANCELLED)
        ) {
          this.logger.error(
            `Payment ${payment.id}: COMPLETED callback შემოვიდა შეკვეთაზე #${orderId}, რომელიც უკვე ${previousStatus}-ია (მარაგი უკვე დაბრუნებულია) — საჭიროა ხელით შემოწმება/თანხის დაბრუნება`,
          );
        }
      }
      // REJECTED-ზე შეკვეთას PENDING-ად ვტოვებთ, რომ მომხმარებელმა ხელახლა
      // სცადოს გადახდა — refund/cancel-ის ცალკე ნაკადი BOG-თან ინტეგრაციისას.

      await manager.save(payment);
    });
  }

  // ⚠️ უსაფრთხოების შენიშვნა (PaymentsController.completeMockPayment): ეს
  // route ბრაუზერის პირდაპირი GET navigation-ით მუშაობს, ანუ JwtAuthGuard-ს
  // ვერ ვიყენებთ (ბრაუზერს Bearer header-ის დართვა plain navigation-ზე არ
  // შეუძლია) და, შესაბამისად, findOneForUser-ით მომხმარებლის ვინაობის
  // გადამოწმებაც შეუძლებელია. ამის მაგივრად externalId (unguessable UUID,
  // იხ. MockPaymentProvider.createPayment) თავად ფუნქციონირებს capability
  // ტოკენად — ვამოწმებთ, რომ ის ზუსტად ამ orderId-ის Payment-ს ეკუთვნის და
  // არა შემთხვევით სხვა შეკვეთის externalId-ია მოსული. ვინც ეს წყვილი არ
  // იცის (ანუ არ გაუვლია initiate() JwtAuthGuard-ის მიღმა), ვერაფერს
  // "გადაიხდის".
  async assertPaymentMatchesOrderForMockComplete(
    orderId: number,
    externalId: string,
  ): Promise<Order> {
    const payment = await this.paymentRepository.findOne({
      where: { order: { id: orderId } },
      relations: { order: true },
    });
    if (!payment || payment.providerOrderId !== externalId) {
      throw new ForbiddenException(
        'გადახდის ID არ ემთხვევა მითითებულ შეკვეთას',
      );
    }

    return payment.order;
  }
}
