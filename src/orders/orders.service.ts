import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  DataSource,
  EntityManager,
  Repository,
  SelectQueryBuilder,
  LessThan,
} from 'typeorm';
import { Order, OrderStatus, DeliveryMethod } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderStatusHistory } from './entities/order-status-history.entity';
import { Product } from '../products/entities/product.entity';
import { ProductColor } from '../products/entities/product-color.entity';
import { ProductBranch } from '../products/entities/product-branch.entity';
import { Payment, PaymentStatus } from '../payments/entities/payment.entity';
import { CartService } from '../cart/cart.service';
import { SearchOrderDto } from './dto/search-order.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { resolveSortColumn } from '../common/dto/pagination.dto';
import { User, UserRole } from '../users/entities/user.entity';
import { BranchesService } from '../branches/branches.service';
import { resolveTranslation } from '../common/utils/resolve-translation.util';
import { maskPhoneNumber } from '../common/utils/mask.util';
import { isAdminRole } from '../common/utils/is-admin.util';

// გადაუხდელი შეკვეთის default ვადა (წუთებში) — ამის შემდეგ cron (Phase 5)
// EXPIRED-ში გადაჰყავს და მარაგს აბრუნებს.
const DEFAULT_ORDER_TTL_MINUTES = 15;

const SORTABLE_COLUMNS = new Set(['id', 'status', 'totalAmount', 'createdAt']);

// დასაშვები status-ტრანზაქციების state-machine — UpdateOrderStatusDto აქამდე
// ნებისმიერ OrderStatus-ს იღებდა @IsEnum-ის მეტი შემოწმების გარეშე (DELIVERED
// → PENDING-იც კი დაშვებული იყო), რაც სწორედ ის მექანიზმი იყო, რომელიც
// cancel → reopen → cancel ციკლში მარაგის ორმაგ დაბრუნებას აძლევდა
// საშუალებას. CANCELLED/EXPIRED ორივე ტერმინალურია — მათგან არსად არ არსებობს
// გამოსავალი, ანუ "reopen" საერთოდ აღარ არის შესაძლებელი სტატუსების დონეზე.
const ALLOWED_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [
    OrderStatus.PAID,
    OrderStatus.CANCELLED,
    OrderStatus.EXPIRED,
  ],
  [OrderStatus.PAID]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.EXPIRED]: [],
};

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectDataSource()
    private dataSource: DataSource,
    private cartService: CartService,
    private branchesService: BranchesService,
  ) {}

  // კალათიდან შეკვეთის შექმნა — ტრანზაქციაში, პროდუქტების row-level ლოქით
  // (pessimistic_write), რომ ორ პარალელურ checkout-ს ერთი და იმავე პროდუქტის
  // ბოლო ერთეულზე ორივემ ვერ გაიაროს stock-შემოწმება ერთდროულად.
  async createFromCart(
    userId: number,
    createOrderDto: CreateOrderDto,
  ): Promise<Order> {
    const deliveryMethod =
      createOrderDto.deliveryMethod ?? DeliveryMethod.COURIER;

    // pickup-ის შემთხვევაში ფილიალის არსებობას წინასწარ ვამოწმებთ
    // ტრანზაქციის გარეთ — DTO-ს @ValidateIf branchId-ის არსებობას მხოლოდ
    // ფორმალურად ამოწმებს, აქ კი რეალურად ვეძებთ ჩანაწერს.
    const branch =
      deliveryMethod === DeliveryMethod.PICKUP
        ? await this.branchesService.findOne(createOrderDto.branchId!)
        : undefined;

    // findOne() (branchesService-ში) isActive-ს არ ამოწმებს — ის მხოლოდ
    // findAllActive()-ისთვისაა (checkout-ის ფილიალების სია). აქ ცალკე
    // ვამოწმებთ, რომ დახურულ/დეაქტივირებულ ფილიალზე pickup ვერ გაფორმდეს
    // (იგივე პატერნი, რაც ქვემოთ product.isActive-ის ხელახლა შემოწმებაზეა).
    if (branch && !branch.isActive) {
      throw new BadRequestException(
        `ფილიალი "${branch.title}" ამჟამად დახურულია`,
      );
    }

    const shippingAddress =
      deliveryMethod === DeliveryMethod.PICKUP
        ? branch!.address
        : createOrderDto.shippingAddress!;

    const cart = await this.cartService.getOrCreateForUser(userId);
    if (!cart.items?.length) {
      throw new BadRequestException('კალათა ცარიელია');
    }

    // row-ლოქები product.id-ის ასაკენდელი მიხედვით ვღებულობთ — არა cart.items-ის
    // ბუნებრივი (ჩამატების) რიგით. ორი პარალელური checkout, რომლებიც იმავე
    // პროდუქტებს საწინააღმდეგო თანმიმდევრობით ამატებდნენ კალათაში (ან
    // სხვადასხვა დროს), ლოქებს ერთნაირი, კანონიკური თანმიმდევრობით იღებენ —
    // Postgres-ის deadlock aborts (ერთ-ერთი ტრანზაქცია raw, unhandled
    // შეცდომით) ამით აღარ ხდება.
    const sortedCartItems = [...cart.items].sort(
      (a, b) => a.product.id - b.product.id,
    );

    const orderId = await this.dataSource.transaction(async (manager) => {
      const orderItems: OrderItem[] = [];
      let totalAmount = 0;

      for (const cartItem of sortedCartItems) {
        // ვბლოკავთ პროდუქტის row-ს ტრანზაქციის ბოლომდე — cart-ში
        // წაკითხული stock ძველი შეიძლება იყოს, ამიტომ ხელახლა ვკითხულობთ
        // ლოქის ქვეშ და მხოლოდ ამის მიხედვით ვწყვეტთ.
        const product = await manager
          .createQueryBuilder(Product, 'product')
          .setLock('pessimistic_write')
          .where('product.id = :id', { id: cartItem.product.id })
          .getOne();

        if (!product) {
          throw new BadRequestException(
            `პროდუქტი "${resolveTranslation(cartItem.product.translations, 'ka')?.name}" აღარ არსებობს`,
          );
        }

        // ეს ka-ზე ცალსახად დაფიქსირებული internal error message-ებია
        // (checkout-ის ვალიდაცია), არა მომხმარებლის locale-ზე დამოკიდებული
        // storefront ტექსტი — resolveTranslation(..., 'ka') განზრახ hardcoded-ია.
        const productName = resolveTranslation(
          product.translations,
          'ka',
        )?.name;

        // დეაქტივირებული პროდუქტი კალათაში შეიძლება უკვე იდებდეს (მანამდე
        // აქტიური იყო) — checkout-ზე ხელახლა ვამოწმებთ, რომ დეაქტივაციის
        // შემდეგ ყიდვა ვერ მოხდეს.
        if (!product.isActive) {
          throw new BadRequestException(
            `პროდუქტი "${productName}" აღარ არის ხელმისაწვდომი`,
          );
        }

        // თუ ეს კალათის item ფერზეა არჩეული — მარაგის შემოწმება/დაკლება
        // ხდება კონკრეტული ProductColor.stock-ზე (არა product.stock-ზე).
        // Product-ის row-ლოქი (ზემოთ) უკვე სერიალიზებს ამ პროდუქტის ყველა
        // ფერის checkout-საც, ამიტომ ProductColor-ზე ცალკე ლოქი საჭირო არ არის.
        let productColor: ProductColor | null = null;
        if (cartItem.colorId) {
          productColor = await manager.findOne(ProductColor, {
            where: { productId: product.id, colorId: cartItem.colorId },
            relations: { color: true },
          });
          if (!productColor) {
            throw new BadRequestException(
              `არჩეული ფერი პროდუქტისთვის "${productName}" აღარ არსებობს`,
            );
          }
          if (productColor.stock < cartItem.quantity) {
            throw new BadRequestException(
              `მარაგში საკმარისი რაოდენობა არ არის ფერისთვის "${resolveTranslation(productColor.color.translations, 'ka')?.name}" (ხელმისაწვდომია: ${productColor.stock})`,
            );
          }
          productColor.stock -= cartItem.quantity;
          await manager.save(productColor);
        } else if (product.stock < cartItem.quantity) {
          throw new BadRequestException(
            `მარაგში საკმარისი რაოდენობა არ არის პროდუქტისთვის "${productName}" (ხელმისაწვდომია: ${product.stock})`,
          );
        }

        // product.stock ორივე შემთხვევაში იკლებს — ფერიანი პროდუქტისთვის
        // ეს ჯამური/ყველა-ფერიანი მარაგის ასახვაა (ProductsService.setColors
        // ინახავს product.stock-ს = ფერების stock-ების ჯამი, ამიტომ იგივე
        // დაკლება ორივეზე ინვარიანტს არღვევს არ ტოვებს).
        product.stock -= cartItem.quantity;
        await manager.save(product);

        // pickup-ის შემთხვევაში მარაგის შემოწმება/დაკლება ხდება არჩეული
        // ფილიალის ProductBranch.stock-ზეც (product.stock-ისგან და
        // ProductColor.stock-ისგან დამოუკიდებელი დამატებითი განზომილება) —
        // Product-ის row-ლოქი ზემოთ ამასაც სერიალიზებს.
        if (deliveryMethod === DeliveryMethod.PICKUP) {
          const productBranch = await manager.findOne(ProductBranch, {
            where: { productId: product.id, branchId: branch!.id },
          });
          if (!productBranch) {
            throw new BadRequestException(
              `პროდუქტი "${productName}" ფილიალში "${branch!.title}" არ იყიდება`,
            );
          }
          if (productBranch.stock < cartItem.quantity) {
            throw new BadRequestException(
              `მარაგში საკმარისი რაოდენობა არ არის ფილიალში "${branch!.title}" პროდუქტისთვის "${productName}" (ხელმისაწვდომია: ${productBranch.stock})`,
            );
          }
          productBranch.stock -= cartItem.quantity;
          await manager.save(productBranch);
        }

        // შეკვეთაში unitPrice-ად ფასდაკლებული ფასი ინახება (თუ discountPercent
        // დაყენებულია) — იგივე ფორმულა, რასაც ფრონტი იყენებს ჩვენებისას
        // (price - price * discountPercent / 100), რომ checkout-ის summary-ში
        // ნაჩვენები და შეკვეთაში დაფიქსირებული ფასი ერთმანეთს ემთხვეოდეს.
        const basePrice = parseFloat(product.price);
        const discountPercent = product.discountPercent ?? 0;
        const unitPrice =
          discountPercent > 0
            ? basePrice * (1 - discountPercent / 100)
            : basePrice;
        // unitPrice-ს ვამრგვალებთ აქვე, სანამ totalAmount-ს დავამატებთ —
        // OrderItem.unitPrice ისედაც დამრგვალებული (2 ათწილადი) ინახება,
        // ხოლო თუ totalAmount დაუმრგვალებელი unitPrice-ებით დაგროვდებოდა
        // და მხოლოდ ბოლოს დამრგვალდებოდა, ორივე შეიძლებოდა ერთმანეთს
        // არ დამთხვეოდა (მაგ. 2×13.3933 → item 13.39, ჯამში 26.79, მაგრამ
        // 2×13.39=26.78) — totalAmount ახლა უკვე დამრგვალებული
        // per-line თანხების ჯამია, არა დაუმრგვალებელი შუალედური მნიშვნელობებისა.
        const roundedUnitPrice = Math.round(unitPrice * 100) / 100;
        totalAmount += roundedUnitPrice * cartItem.quantity;

        orderItems.push(
          manager.create(OrderItem, {
            product,
            productName,
            colorId: productColor?.colorId ?? null,
            colorName: productColor
              ? resolveTranslation(productColor.color.translations, 'ka')?.name
              : undefined,
            unitPrice: roundedUnitPrice.toFixed(2),
            quantity: cartItem.quantity,
          }),
        );
      }

      const expiresAt = new Date(
        Date.now() + DEFAULT_ORDER_TTL_MINUTES * 60 * 1000,
      );

      const order = manager.create(Order, {
        user: { id: userId },
        items: orderItems,
        status: OrderStatus.PENDING,
        totalAmount: totalAmount.toFixed(2),
        deliveryMethod,
        branch: branch ? { id: branch.id } : undefined,
        shippingAddress,
        expiresAt,
      });
      const savedOrder = await manager.save(order);
      await this.recordStatusHistory(
        manager,
        savedOrder.id,
        OrderStatus.PENDING,
      );
      return savedOrder.id;
    });

    // ტრანზაქციის წარმატებით დასრულების შემდეგ ვასუფთავებთ კალათას —
    // ცალკე, ორდერის ტრანზაქციის გარეთ, რადგან CartService საკუთარ
    // repository-ებს იყენებს და ორდერის ლოქებთან შერევა ზედმეტია.
    await this.cartService.clear(userId);

    return this.findOrderOrThrow(orderId);
  }

  async findAllForUser(
    userId: number,
    searchOrderDto: SearchOrderDto,
  ): Promise<PaginatedResponseDto<Order>> {
    return this.paginate(searchOrderDto, (qb) =>
      qb.andWhere('user.id = :userId', { userId }),
    );
  }

  async findAllPaginated(
    searchOrderDto: SearchOrderDto,
  ): Promise<PaginatedResponseDto<Order>> {
    return this.paginate(searchOrderDto);
  }

  async findOneForUser(
    userId: number,
    role: UserRole,
    orderId: number,
  ): Promise<Order> {
    const order = await this.findOrderOrThrow(orderId, {
      includeHistory: true,
    });
    const isAdmin = isAdminRole(role);
    if (!isAdmin && order.user.id !== userId) {
      throw new ForbiddenException('ამ შეკვეთის ნახვის უფლება არ გაქვთ');
    }
    return order;
  }

  // ადმინის მიერ სტატუსის ცვლილება (ან მომავალში — Payments callback-იდან).
  // ტრანზაქცია მხოლოდ ALLOWED_STATUS_TRANSITIONS-ით დაშვებულ გადასვლებზე
  // სრულდება (DELIVERED → PENDING და მისთ. ახლა 400-ს აბრუნებს). CANCELLED-
  // ან EXPIRED-ზე გადასვლისას (ორივეზე, არა მხოლოდ CANCELLED-ზე) ვაბრუნებთ
  // მარაგს — order.stockRestored flag-ით დაცული, არა მხოლოდ მიმდინარე
  // status-ის შემოწმებით, რომ ერთსა და იმავე შეკვეთაზე restock ორჯერ ვერ
  // შესრულდეს (რეალურად ეს ორმაგი-გამოძახება ახლა state-machine-ითაც
  // დაბლოკილია, ვინაიდან CANCELLED/EXPIRED ტერმინალურია — flag-ი დამატებითი,
  // defense-in-depth შრეა).
  async updateStatus(
    orderId: number,
    status: OrderStatus,
    changedById?: number,
  ): Promise<Order> {
    const order = await this.findOrderOrThrow(orderId);

    if (order.status === status) {
      return order;
    }

    const allowedNext = ALLOWED_STATUS_TRANSITIONS[order.status] ?? [];
    if (!allowedNext.includes(status)) {
      throw new BadRequestException(
        `სტატუსის ცვლილება "${order.status}" → "${status}" დაუშვებელია`,
      );
    }

    const needsRestock =
      (status === OrderStatus.CANCELLED || status === OrderStatus.EXPIRED) &&
      !order.stockRestored;

    // PAID/PROCESSING → CANCELLED (ADMIN-ის მიერ) მარაგს აბრუნებს, მაგრამ
    // Payment row-ს აქამდე ხელუხლებელი COMPLETED ტოვებდა — არსად აღარ ჩანდა,
    // რომ ფაქტობრივად თანხის დაბრუნება ეკუთვნის ამ შეკვეთას. მნიშვნელოვანია
    // შევამოწმოთ *მიმდინარე* order.status ნაცვლად "იყო თუ არა ოდესმე
    // გადახდილი" — PAID-იდან PROCESSING-ში გადასული შეკვეთის cancel-ისას
    // order.status უკვე PROCESSING-ია, არა PAID, ამიტომ მხოლოდ
    // `order.status === PAID` შემოწმება ამ შემთხვევაში REFUND-ის ალამს
    // ჩუმად კარგავდა. რეალური refund BOG-თან (ისევე, როგორც REJECTED-ის
    // შემთხვევაში) v1-ში out-of-scope-ია (იხ. PaymentsService.handleCallback-ის
    // კომენტარი) — აქ მხოლოდ Payment სტატუსს ვნიშნავთ REFUNDED-ად, რომ ეს
    // ვალდებულება მოჩანდეს/ტრეკვადი იყოს (ხელით დამუშავებამდე).
    const wasPaid =
      order.status === OrderStatus.PAID ||
      order.status === OrderStatus.PROCESSING;

    // ერთ ტრანზაქციაში ვასრულებთ status-ცვლილებას (+ needsRestock-ის
    // შემთხვევაში restock/refund-flag) და history-row-ს ჩაწერას ერთდროულად —
    // history ჩანაწერი არასდროს არ დარჩება Order.status-ის ცვლილებას
    // მიღმა (ან პირიქით), ერთ atomicity-ის ფარგლებშია ორივე.
    await this.dataSource.transaction(async (manager) => {
      if (needsRestock) {
        await this.restockOrderItems(manager, order);
        await manager.update(Order, orderId, { status, stockRestored: true });
        if (wasPaid && status === OrderStatus.CANCELLED) {
          await manager.update(
            Payment,
            { order: { id: orderId }, status: PaymentStatus.COMPLETED },
            { status: PaymentStatus.REFUNDED },
          );
        }
      } else {
        await manager.update(Order, orderId, { status });
      }
      await this.recordStatusHistory(manager, orderId, status, changedById);
    });

    return this.findOrderOrThrow(orderId);
  }

  // ყოველ წუთს იძახებს expireStaleOrders-ს — ვადაგასული PENDING შეკვეთების
  // ავტომატური EXPIRED-ში გადაყვანა და მარაგის დაბრუნება (Phase 5).
  @Cron(CronExpression.EVERY_MINUTE)
  async handleExpiredOrders() {
    await this.expireStaleOrders();
  }

  // PENDING შეკვეთები, რომელთა ვადაც (expiresAt) გავიდა — EXPIRED-ში
  // გადაჰყავს და მარაგს უბრუნებს. Cron-ის მიერ გამოძახებული (Phase 5).
  async expireStaleOrders(): Promise<number> {
    const staleOrders = await this.orderRepository.find({
      where: { status: OrderStatus.PENDING, expiresAt: LessThan(new Date()) },
      relations: { items: { product: true }, branch: true },
    });

    for (const order of staleOrders) {
      await this.dataSource.transaction(async (manager) => {
        if (!order.stockRestored) {
          await this.restockOrderItems(manager, order);
        }
        await manager.update(Order, order.id, {
          status: OrderStatus.EXPIRED,
          stockRestored: true,
        });
        // changedBy არაა — cron-ის ავტომატური, სისტემური გადასვლაა.
        await this.recordStatusHistory(manager, order.id, OrderStatus.EXPIRED);
      });
    }

    return staleOrders.length;
  }

  // ⚠️ ფიქსი: აქამდე თითო order item-ზე თანმიმდევრობით (sequentially
  // awaited) გადიოდა 1-3 ცალკე UPDATE (Product/ProductColor/ProductBranch) —
  // @Cron(EVERY_MINUTE)-ით გაშვებულ expireStaleOrders-ში ბევრ item-იან
  // ვადაგასულ შეკვეთაზე ეს ხდებოდა N ცალკე round-trip ერთმანეთის მიყოლებით.
  // ახლა თითო ცხრილზე item-ები productId-ით (საჭიროებისას productId+colorId /
  // productId+branchId-ით) ჯამდება და ერთი bulk UPDATE...FROM (VALUES...)
  // სრულდება ცხრილზე, სულ მაქსიმუმ 3 query — item-ების რაოდენობის
  // მიუხედავად.
  private async restockOrderItems(manager: EntityManager, order: Order) {
    const productQty = new Map<number, number>();
    const colorQty = new Map<
      string,
      { productId: number; colorId: string; qty: number }
    >();
    const branchQty = new Map<
      string,
      { productId: number; branchId: number; qty: number }
    >();

    for (const item of order.items) {
      if (!item.product) continue; // პროდუქტი უკვე წაშლილია — აღარაფერზე ვაბრუნებთ
      const productId = item.product.id;
      productQty.set(
        productId,
        (productQty.get(productId) ?? 0) + item.quantity,
      );

      // ფერზე გაფორმებული item-ისთვის კონკრეტული ProductColor.stock-საც
      // ვაბრუნებთ (თუ ეს ფერი შუალედში არ წაშლილა) — createFromCart-ის
      // იგივე დაკლების საპირისპირო მოქმედება.
      if (item.colorId) {
        const key = `${productId}:${item.colorId}`;
        const existing = colorQty.get(key);
        colorQty.set(key, {
          productId,
          colorId: item.colorId,
          qty: (existing?.qty ?? 0) + item.quantity,
        });
      }

      // pickup შეკვეთისთვის — createFromCart-ის ProductBranch.stock დაკლების
      // საპირისპირო მოქმედება (თუ ეს ფილიალი შუალედში არ წაშლილა).
      if (order.deliveryMethod === DeliveryMethod.PICKUP && order.branch) {
        const key = `${productId}:${order.branch.id}`;
        const existing = branchQty.get(key);
        branchQty.set(key, {
          productId,
          branchId: order.branch.id,
          qty: (existing?.qty ?? 0) + item.quantity,
        });
      }
    }

    if (productQty.size > 0) {
      const entries = [...productQty.entries()];
      const values = entries
        .map((_, i) => `($${i * 2 + 1}::int, $${i * 2 + 2}::int)`)
        .join(', ');
      const params = entries.flatMap(([id, qty]) => [id, qty]);
      await manager.query(
        `UPDATE "product" AS p SET stock = p.stock + v.qty
         FROM (VALUES ${values}) AS v(id, qty)
         WHERE p.id = v.id`,
        params,
      );
    }

    if (colorQty.size > 0) {
      const entries = [...colorQty.values()];
      const values = entries
        .map(
          (_, i) =>
            `($${i * 3 + 1}::int, $${i * 3 + 2}::uuid, $${i * 3 + 3}::int)`,
        )
        .join(', ');
      const params = entries.flatMap((e) => [e.productId, e.colorId, e.qty]);
      await manager.query(
        `UPDATE "product_color" AS pc SET stock = pc.stock + v.qty
         FROM (VALUES ${values}) AS v("productId", "colorId", qty)
         WHERE pc."productId" = v."productId" AND pc."colorId" = v."colorId"`,
        params,
      );
    }

    if (branchQty.size > 0) {
      const entries = [...branchQty.values()];
      const values = entries
        .map(
          (_, i) =>
            `($${i * 3 + 1}::int, $${i * 3 + 2}::int, $${i * 3 + 3}::int)`,
        )
        .join(', ');
      const params = entries.flatMap((e) => [e.productId, e.branchId, e.qty]);
      await manager.query(
        `UPDATE "product_branch" AS pb SET stock = pb.stock + v.qty
         FROM (VALUES ${values}) AS v("productId", "branchId", qty)
         WHERE pb."productId" = v."productId" AND pb."branchId" = v."branchId"`,
        params,
      );
    }
  }

  private async findOrderOrThrow(
    orderId: number,
    options?: { includeHistory?: boolean },
  ): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: {
        items: { product: true },
        user: true,
        branch: true,
        // მხოლოდ GET /orders/:id-ს ერთი შეკვეთის დეტალზეა საჭირო — სიის
        // endpoint-ები (paginate()) ცალკე query builder-ს იყენებენ და ამ
        // relation-ს არასდროს ტვირთავენ.
        ...(options?.includeHistory
          ? { statusHistory: { changedBy: true } }
          : {}),
      },
      // password/etc. აქ არ გვჭირდება — user მხოლოდ owner-ის ID-ის
      // შესამოწმებლადაა საჭირო, არ უნდა გავჟონოთ ჰეშირებული პაროლი კლიენტამდე.
      // იგივე ეხება statusHistory.changedBy-საც — ადმინის ID/სახელი საკმარისია.
      select: {
        user: { id: true },
        ...(options?.includeHistory
          ? {
              statusHistory: {
                id: true,
                status: true,
                createdAt: true,
                changedBy: { id: true, firstName: true, lastName: true },
              },
            }
          : {}),
      },
      // id აქ ტაი-ბრეიკერია createdAt-ის შემდეგ — ორი ცვლილება ერთ
      // მილიწამში რომ ჩაიწეროს (სწრაფი, თანმიმდევრული status-განახლებები),
      // ჩაწერის თანმიმდევრობა მაინც გარანტირებულია, timestamp-ის
      // გარჩევადობაზე დამოკიდებული აღარაა.
      ...(options?.includeHistory
        ? { order: { statusHistory: { createdAt: 'ASC', id: 'ASC' } } }
        : {}),
    });
    if (!order) {
      throw new NotFoundException(`შეკვეთა ID-ით ${orderId} ვერ მოიძებნა`);
    }
    return order;
  }

  // ერთადერთი ადგილი, სადაც status-history row ჩაწერის ხდება — ადმინის
  // ხელით ცვლილება, BOG webhook (pending→paid) და cron-ის ვადაგასულის
  // expire (pending→expired) ყველა ამ მეთოდის მეშვეობით გადიან, რომ ერთი
  // ტრანზაქციის ფარგლებში ერთდროულად ჩაიწეროს Order.status-ის ცვლილებასთან
  // ერთად. changedBy undefined/null სისტემური/ავტომატური გადასვლისას (BOG
  // callback, cron) — ადმინის ID მხოლოდ OrdersController-ის PATCH :id/status-იდან მოდის.
  private async recordStatusHistory(
    manager: EntityManager,
    orderId: number,
    status: OrderStatus,
    changedById?: number,
  ): Promise<void> {
    const history = manager.create(OrderStatusHistory, {
      order: { id: orderId } as Order,
      status,
      changedBy: changedById ? ({ id: changedById } as User) : undefined,
    });
    await manager.save(history);
  }

  private async paginate(
    searchOrderDto: SearchOrderDto,
    extra?: (qb: SelectQueryBuilder<Order>) => void,
  ): Promise<PaginatedResponseDto<Order>> {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      order = 'DESC',
      status,
    } = searchOrderDto;

    const qb = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .leftJoinAndSelect('order.branch', 'branch')
      // user-ის მხოლოდ ID/სახელი/email გვჭირდება — არასდროს password
      // (leftJoinAndSelect მთელ user entity-ს, ჰეშირებულ პაროლის ჩათვლით,
      // დააბრუნებდა response-ში).
      .leftJoin('order.user', 'user')
      .addSelect([
        'user.id',
        'user.firstName',
        'user.lastName',
        'user.email',
        'user.phoneNumber',
      ]);

    if (extra) {
      extra(qb);
    }

    if (status) {
      qb.andWhere('order.status = :status', { status });
    }

    const sortColumn = resolveSortColumn(sortBy, SORTABLE_COLUMNS, 'createdAt');
    qb.orderBy(`order.${sortColumn}`, order === 'ASC' ? 'ASC' : 'DESC');

    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();

    // ⚠️ უსაფრთხოების ფიქსი: user.phoneNumber ზემოთ დეშიფრული სახით ირჩევა
    // (encryptedColumnTransformer ავტომატურად შიფრავს), მაგრამ ისევე, როგორც
    // AuthService.generateToken() masking იყენებს login/register პასუხში,
    // სიაშიც (მათ შორის GET /orders/admin/all) მხოლოდ ნიღბიანი ვერსია უნდა
    // გავცეთ — სრული ნომერი კონკრეტული შეკვეთის დეტალზეა საჭირო, არა სიაში.
    for (const order of data) {
      if (order.user) {
        order.user.phoneNumber = maskPhoneNumber(order.user.phoneNumber);
      }
    }

    return new PaginatedResponseDto(data, total, page, limit);
  }
}
