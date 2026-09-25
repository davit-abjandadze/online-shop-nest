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
  IsNull,
} from 'typeorm';
import { Order, OrderStatus, DeliveryMethod } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderStatusHistory } from './entities/order-status-history.entity';
import { Product } from '../products/entities/product.entity';
import { ProductColor } from '../products/entities/product-color.entity';
import { ProductBranch } from '../products/entities/product-branch.entity';
import { ProductVariant } from '../products/entities/product-variant.entity';
import { Payment, PaymentStatus } from '../payments/entities/payment.entity';
import { CartService } from '../cart/cart.service';
import { Cart } from '../cart/entities/cart.entity';
import { CartItem } from '../cart/entities/cart-item.entity';
import { SearchOrderDto } from './dto/search-order.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { paginate as paginateQuery } from '../common/utils/paginate.util';
import { User, UserRole } from '../users/entities/user.entity';
import { BranchesService } from '../branches/branches.service';
import { resolveTranslation } from '../common/utils/resolve-translation.util';
import { maskPhoneNumber } from '../common/utils/mask.util';
import { isAdminRole } from '../common/utils/is-admin.util';

// გადაუხდელი შეკვეთის default ვადა (წუთებში) — ამის შემდეგ cron (Phase 5)
// EXPIRED-ში გადაჰყავს და მარაგს აბრუნებს.
const DEFAULT_ORDER_TTL_MINUTES = 15;

// ერთ მომხმარებელზე ერთდროულად გადაუხდელი (PENDING) შეკვეთების მაქსიმუმი.
const MAX_PENDING_ORDERS_PER_USER = 3;

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
  private async assertUserCanPurchase(userId: number): Promise<void> {
    const user = await this.dataSource.getRepository(User).findOne({
      where: { id: userId },
      select: {
        id: true,
        isEmailVerified: true,
        isPhoneVerified: true,
        personalNumber: true,
      },
    });
    if (!user) {
      throw new BadRequestException('მომხმარებელი ვერ მოიძებნა');
    }
    const missing: string[] = [];
    if (!user.isEmailVerified) missing.push('ელფოსტის დადასტურება');
    if (!user.isPhoneVerified) missing.push('მობილურის დადასტურება');
    if (!user.personalNumber?.trim()) missing.push('პირადი ნომრის შევსება');
    if (missing.length) {
      throw new BadRequestException(
        `შეკვეთის გასაფორმებლად საჭიროა: ${missing.join(', ')}`,
      );
    }
  }

  async createFromCart(
    userId: number,
    createOrderDto: CreateOrderDto,
  ): Promise<Order> {
    // ყიდვის წინაპირობები — ადრე მხოლოდ ფრონტის checkout ამოწმებდა, რაც API-ის
    // პირდაპირი გამოძახებით (ან შეუნახავი ველით ფრონტზე) გვერდს უვლიდა.
    // profile/checkout-ის იგივე წესი: დადასტურებული ელფოსტა და მობილური +
    // შევსებული პირადი ნომერი.
    await this.assertUserCanPurchase(userId);

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

    const orderId = await this.dataSource.transaction(async (manager) => {
      // კალათის row-ს ვბლოკავთ და მის items-ს ლოქის ქვეშ ვკითხულობთ — აქამდე
      // კალათა ტრანზაქციის გარეთ იკითხებოდა და მხოლოდ commit-ის შემდეგ
      // სუფთავდებოდა, ამიტომ ორმაგი დაწკაპუნება ერთი კალათიდან ორ შეკვეთას
      // ქმნიდა (და მარაგს ორჯერ აკლებდა). მეორე checkout ახლა პირველის
      // commit-ს ელოდება და უკვე ცარიელ კალათას ხედავს.
      await manager
        .createQueryBuilder(Cart, 'cart')
        .setLock('pessimistic_write')
        .where('cart.id = :id', { id: cart.id })
        .getOne();

      const cartItems = await manager.find(CartItem, {
        where: { cart: { id: cart.id } },
        relations: { product: true },
      });
      if (!cartItems.length) {
        throw new BadRequestException('კალათა ცარიელია');
      }

      // ყოველი PENDING შეკვეთა მარაგს 15 წუთით იკავებს — ლიმიტის გარეშე
      // ერთ მომხმარებელს შეეძლო მთელი მარაგის დაბლოკვა განმეორებითი
      // checkout-ებით (გადახდის გარეშე). კალათის ლოქი ამ შემოწმებას ერთი
      // მომხმარებლისთვის სერიალიზებს.
      const pendingCount = await manager.count(Order, {
        where: { user: { id: userId }, status: OrderStatus.PENDING },
      });
      if (pendingCount >= MAX_PENDING_ORDERS_PER_USER) {
        throw new BadRequestException(
          'გაქვთ გადაუხდელი შეკვეთები — ჯერ გადაიხადეთ ან დაელოდეთ მათ ვადის გასვლას',
        );
      }

      // row-ლოქები product.id-ის ასაკენდელი მიხედვით ვღებულობთ — არა cart.items-ის
      // ბუნებრივი (ჩამატების) რიგით. ორი პარალელური checkout, რომლებიც იმავე
      // პროდუქტებს საწინააღმდეგო თანმიმდევრობით ამატებდნენ კალათაში (ან
      // სხვადასხვა დროს), ლოქებს ერთნაირი, კანონიკური თანმიმდევრობით იღებენ —
      // Postgres-ის deadlock aborts (ერთ-ერთი ტრანზაქცია raw, unhandled
      // შეცდომით) ამით აღარ ხდება.
      const sortedCartItems = [...cartItems].sort(
        (a, b) => a.product.id - b.product.id,
      );

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

        // company მხოლოდ companyId snapshot-ისთვისაა საჭირო — ცალკე,
        // ლოქის გარეშე ვკითხულობთ, რადგან Postgres-ს არ შეუძლია FOR UPDATE
        // nullable outer join-ზე (product.company nullable-ია).
        const productCompany = await manager
          .createQueryBuilder(Product, 'product')
          .leftJoin('product.company', 'company')
          .select('company.id', 'companyId')
          .where('product.id = :id', { id: product.id })
          .getRawOne<{ companyId: string | null }>();

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

        // თუ ეს კალათის item ვარიანტზეა არჩეული (ProductVariant — ფერი+
        // ზომა) — მარაგის შემოწმება/დაკლება ხდება კონკრეტული
        // ProductVariant.stock-ზე, ProductColor-ის იგივე ლოგიკით, მაგრამ
        // ცალკე სისტემაა (ერთსა და იმავე item-ზე ორივე ერთდროულად არ
        // ვარაუდობს). Product-ის row-ლოქი (ზემოთ) უკვე სერიალიზებს ამ
        // პროდუქტის ყველა ვარიანტის/ფერის checkout-საც, ამიტომ
        // ProductVariant/ProductColor-ზე ცალკე ლოქი საჭირო არ არის.
        // "ვარიანტი/ფერი სავალდებულოა" წესს CartService მხოლოდ კალათაში
        // დამატებისას ამოწმებს. თუ ადმინმა ვარიანტები/ფერები მოგვიანებით
        // დაამატა, ძველი item აქ "მარტივ პროდუქტად" გაივლიდა: base ფასით და
        // product.stock-ის (ახლა ვარიანტების ჯამის) დაკლებით, კონკრეტული
        // ვარიანტის მარაგის შეუმცირებლად → ვარიანტების overselling.
        if (!cartItem.variantId) {
          const hasVariants = await manager.exists(ProductVariant, {
            where: { productId: product.id },
          });
          const hasColors =
            !cartItem.colorId &&
            (await manager.exists(ProductColor, {
              where: { productId: product.id },
            }));
          if (hasVariants || hasColors) {
            throw new BadRequestException(
              `პროდუქტს "${productName}" ${hasVariants ? 'ვარიანტის' : 'ფერის'} არჩევა სჭირდება — წაშალეთ კალათიდან და დაამატეთ ხელახლა`,
            );
          }
        }

        let productVariant: ProductVariant | null = null;
        let productColor: ProductColor | null = null;
        if (cartItem.variantId) {
          productVariant = await manager.findOne(ProductVariant, {
            where: { productId: product.id, id: cartItem.variantId },
            relations: { color: true, size: true },
          });
          if (!productVariant) {
            throw new BadRequestException(
              `არჩეული ვარიანტი პროდუქტისთვის "${productName}" აღარ არსებობს`,
            );
          }
          if (productVariant.stock < cartItem.quantity) {
            throw new BadRequestException(
              `მარაგში საკმარისი რაოდენობა არ არის არჩეული ვარიანტისთვის (ხელმისაწვდომია: ${productVariant.stock})`,
            );
          }
          productVariant.stock -= cartItem.quantity;
          await manager.save(productVariant);
        } else if (cartItem.colorId) {
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
        // Product-ის row-ლოქი ზემოთ ამასაც სერიალიზებს. ProductBranch
        // ახლა variantId/colorId-ითაც არის დაყოფილი (იხ. entity-ის
        // კომენტარი) — ვარიანტიან/ფერიან item-ისთვის ვეძებთ ზუსტად იმ
        // variantId/colorId-ის row-ს, ხოლო მარტივი პროდუქტისთვის — "flat"
        // (ორივე null) row-ს. ერთი productId+branchId-ის ქვეშ სხვადასხვა
        // variantId-ის row-ები შეიძლება არსებობდეს ერთდროულად.
        if (deliveryMethod === DeliveryMethod.PICKUP) {
          const productBranch = await manager.findOne(ProductBranch, {
            where: {
              productId: product.id,
              branchId: branch!.id,
              variantId: productVariant ? productVariant.id : IsNull(),
              colorId:
                !productVariant && productColor
                  ? productColor.colorId
                  : IsNull(),
            },
          });
          if (!productBranch) {
            throw new BadRequestException(
              `პროდუქტი "${productName}" ${productVariant ? 'ამ ვარიანტით ' : productColor ? 'ამ ფერით ' : ''}ფილიალში "${branch!.title}" არ იყიდება`,
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
        const basePrice = parseFloat(productVariant?.price ?? product.price);
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
            companyId: productCompany?.companyId ?? null,
            colorId: productColor?.colorId ?? productVariant?.colorId ?? null,
            colorName: productColor
              ? resolveTranslation(productColor.color.translations, 'ka')?.name
              : productVariant?.color
                ? resolveTranslation(productVariant.color.translations, 'ka')
                    ?.name
                : undefined,
            variantId: productVariant?.id ?? null,
            sizeName: productVariant?.size
              ? resolveTranslation(productVariant.size.translations, 'ka')?.name
              : undefined,
            unitPrice: roundedUnitPrice.toFixed(2),
            // ფასდაკლებამდელი ფასი და პროცენტი შეკვეთის მომენტისთვის — ფრონტი
            // გადახაზულ ფასს აქედან აჩვენებს და არა პროდუქტის ცოცხალი
            // (მოგვიანებით შეცვლილი) price/discountPercent-იდან.
            originalUnitPrice:
              discountPercent > 0 ? basePrice.toFixed(2) : null,
            discountPercent: discountPercent > 0 ? discountPercent : null,
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

      // კალათიდან ზუსტად შეკვეთილ item-ებს ვშლით, იმავე ტრანზაქციაში —
      // ადრე commit-ის შემდეგ მთელი კალათა სუფთავდებოდა, მათ შორის შუალედში
      // დამატებული (შეუკვეთავი) item-ებიც.
      await manager.delete(
        CartItem,
        cartItems.map((item) => item.id),
      );
      return savedOrder.id;
    });

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

  // ადმინის მიერ სტატუსის ცვლილება. ტრანზაქცია მხოლოდ
  // ALLOWED_STATUS_TRANSITIONS-ით დაშვებულ გადასვლებზე სრულდება (DELIVERED →
  // PENDING და მისთ. 400-ს აბრუნებს). CANCELLED/EXPIRED-ზე გადასვლისას
  // მარაგი ბრუნდება — order.stockRestored flag-ით დაცული. ყველა შემოწმება
  // transitionStatusInTransaction-შია, order row-ის ლოქის ქვეშ.
  async updateStatus(
    orderId: number,
    status: OrderStatus,
    changedById?: number,
  ): Promise<Order> {
    await this.dataSource.transaction((manager) =>
      this.transitionStatusInTransaction(manager, orderId, status, {
        changedById,
      }),
    );

    // ⚠️ ხელახლა ჩატვირთვა (relations-ებით) აქ განზრახ რჩება — restock
    // პროდუქტის stock-ს raw SQL-ით ცვლის, `updatedAt` კი მხოლოდ DB-ს მხრიდან
    // განახლდება; ორივე ამ პასუხშივე უნდა ჩანდეს განახლებული.
    return this.findOrderOrThrow(orderId);
  }

  // სტატუსის ცვლილების ერთადერთი ადგილი (ადმინი, BOG callback, cron) —
  // გამომძახებლის ტრანზაქციაში სრულდება. order row-ს FOR UPDATE-ით ვბლოკავთ
  // და status/stockRestored-ს ლოქის ქვეშ ვკითხულობთ: აქამდე ორივე ტრანზაქციის
  // გარეთ, ძველი ასლიდან იკითხებოდა, ამიტომ
  //   - ადმინის cancel და cron-ის expire ერთდროულად ორივე აბრუნებდა მარაგს
  //     (stockRestored ორივეს false ეჩვენებოდა) → ორმაგი restock/overselling;
  //   - cron-ი ახლახან გადახდილ (PAID) შეკვეთასაც EXPIRED-ად ხდიდა.
  // მეორე ტრანზაქცია ახლა პირველის commit-ს ელოდება და უკვე ახალ სტატუსს ხედავს.
  //
  // options.onlyFrom — სისტემური გადასვლებისთვის (cron/callback): თუ სტატუსი
  // ლოქის ქვეშ უკვე სხვაა, 400-ის ნაცვლად ჩუმად გამოვტოვებთ.
  // options.onlyIfExpired — cron-ისთვის: expiresAt ლოქის ქვეშ ხელახლა
  // მოწმდება (გადახდის დაწყება მას აგრძელებს, იხ. PaymentsService.initiate).
  async transitionStatusInTransaction(
    manager: EntityManager,
    orderId: number,
    status: OrderStatus,
    options: {
      changedById?: number;
      onlyFrom?: OrderStatus[];
      onlyIfExpired?: boolean;
    } = {},
  ): Promise<{ changed: boolean; previousStatus: OrderStatus }> {
    const order = await manager
      .createQueryBuilder(Order, 'order')
      .setLock('pessimistic_write')
      .where('order.id = :id', { id: orderId })
      .getOne();
    if (!order) {
      throw new NotFoundException(`შეკვეთა ID-ით ${orderId} ვერ მოიძებნა`);
    }

    const previousStatus = order.status;
    if (previousStatus === status) {
      return { changed: false, previousStatus };
    }
    if (options.onlyFrom && !options.onlyFrom.includes(previousStatus)) {
      return { changed: false, previousStatus };
    }
    if (
      options.onlyIfExpired &&
      !(order.expiresAt && order.expiresAt.getTime() < Date.now())
    ) {
      return { changed: false, previousStatus };
    }

    const allowedNext = ALLOWED_STATUS_TRANSITIONS[previousStatus] ?? [];
    if (!allowedNext.includes(status)) {
      throw new BadRequestException(
        `სტატუსის ცვლილება "${previousStatus}" → "${status}" დაუშვებელია`,
      );
    }

    const needsRestock =
      (status === OrderStatus.CANCELLED || status === OrderStatus.EXPIRED) &&
      !order.stockRestored;

    // PAID/PROCESSING → CANCELLED: Payment-ს ვნიშნავთ REFUNDED-ად, რომ
    // თანხის დაბრუნების ვალდებულება ჩანდეს (რეალური refund BOG-თან
    // ინტეგრაციასთან ერთად გაკეთდება). *მიმდინარე* სტატუსს ვამოწმებთ —
    // PROCESSING-იც გადახდილია.
    const wasPaid =
      previousStatus === OrderStatus.PAID ||
      previousStatus === OrderStatus.PROCESSING;

    if (needsRestock) {
      // items/branch ლოქის შემდეგ, იმავე ტრანზაქციაში — FOR UPDATE-ს
      // nullable outer join-თან (items.product, branch) Postgres არ უშვებს.
      const withRelations = await manager.findOne(Order, {
        where: { id: orderId },
        relations: { items: { product: true }, branch: true },
      });
      await this.restockOrderItems(manager, withRelations ?? order);
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
    await this.recordStatusHistory(
      manager,
      orderId,
      status,
      options.changedById,
    );
    return { changed: true, previousStatus };
  }

  // ყოველ წუთს იძახებს expireStaleOrders-ს — ვადაგასული PENDING შეკვეთების
  // ავტომატური EXPIRED-ში გადაყვანა და მარაგის დაბრუნება (Phase 5).
  @Cron(CronExpression.EVERY_MINUTE)
  async handleExpiredOrders() {
    await this.expireStaleOrders();
  }

  // PENDING შეკვეთები, რომელთა ვადაც (expiresAt) გავიდა — EXPIRED-ში
  // გადაჰყავს და მარაგს უბრუნებს. აქ მხოლოდ კანდიდატების ID-ებს ვკითხულობთ —
  // სტატუსი/ვადა თითოეულისთვის ლოქის ქვეშ ხელახლა მოწმდება
  // (transitionStatusInTransaction), რადგან სიის წაკითხვასა და ცვლილებას
  // შორის შეკვეთა შეიძლება გადაიხადონ ან ადმინმა გააუქმოს.
  async expireStaleOrders(): Promise<number> {
    const staleOrders = await this.orderRepository.find({
      select: { id: true },
      where: { status: OrderStatus.PENDING, expiresAt: LessThan(new Date()) },
    });

    let expired = 0;
    for (const { id } of staleOrders) {
      const { changed } = await this.dataSource.transaction((manager) =>
        this.transitionStatusInTransaction(manager, id, OrderStatus.EXPIRED, {
          onlyFrom: [OrderStatus.PENDING],
          onlyIfExpired: true,
        }),
      );
      if (changed) expired += 1;
    }

    return expired;
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
    const variantQty = new Map<string, { variantId: string; qty: number }>();
    const branchQty = new Map<
      string,
      {
        productId: number;
        branchId: number;
        variantId: string | null;
        colorId: string | null;
        qty: number;
      }
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

      // ვარიანტზე (ProductVariant) გაფორმებული item-ისთვის — createFromCart-ის
      // ProductVariant.stock დაკლების საპირისპირო მოქმედება (თუ ეს
      // ვარიანტი შუალედში არ წაშლილა).
      if (item.variantId) {
        const existing = variantQty.get(item.variantId);
        variantQty.set(item.variantId, {
          variantId: item.variantId,
          qty: (existing?.qty ?? 0) + item.quantity,
        });
      }

      // pickup შეკვეთისთვის — createFromCart-ის ProductBranch.stock დაკლების
      // საპირისპირო მოქმედება (თუ ეს ფილიალი შუალედში არ წაშლილა).
      // ProductBranch ახლა variantId/colorId-ითაც არის დაყოფილი, ამიტომ
      // აქაც იმავე variantId/colorId-ის row-ს ვეძებთ, რასაც createFromCart-მა
      // დააკლო — წინააღმდეგ შემთხვევაში (მხოლოდ productId+branchId-ით)
      // შეცდომით შესაძლოა სხვა variantId-ის row-ს დაემატოს მარაგი.
      if (order.deliveryMethod === DeliveryMethod.PICKUP && order.branch) {
        const variantId = item.variantId ?? null;
        const colorId = !item.variantId ? (item.colorId ?? null) : null;
        const key = `${productId}:${order.branch.id}:${variantId ?? ''}:${colorId ?? ''}`;
        const existing = branchQty.get(key);
        branchQty.set(key, {
          productId,
          branchId: order.branch.id,
          variantId,
          colorId,
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

    if (variantQty.size > 0) {
      const entries = [...variantQty.values()];
      const values = entries
        .map((_, i) => `($${i * 2 + 1}::uuid, $${i * 2 + 2}::int)`)
        .join(', ');
      const params = entries.flatMap((e) => [e.variantId, e.qty]);
      await manager.query(
        `UPDATE "product_variant" AS pv SET stock = pv.stock + v.qty
         FROM (VALUES ${values}) AS v(id, qty)
         WHERE pv.id = v.id`,
        params,
      );
    }

    if (branchQty.size > 0) {
      const entries = [...branchQty.values()];
      const values = entries
        .map(
          (_, i) =>
            `($${i * 5 + 1}::int, $${i * 5 + 2}::int, $${i * 5 + 3}::uuid, $${i * 5 + 4}::uuid, $${i * 5 + 5}::int)`,
        )
        .join(', ');
      const params = entries.flatMap((e) => [
        e.productId,
        e.branchId,
        e.variantId,
        e.colorId,
        e.qty,
      ]);
      await manager.query(
        `UPDATE "product_branch" AS pb SET stock = pb.stock + v.qty
         FROM (VALUES ${values}) AS v("productId", "branchId", "variantId", "colorId", qty)
         WHERE pb."productId" = v."productId" AND pb."branchId" = v."branchId"
           AND pb."variantId" IS NOT DISTINCT FROM v."variantId"
           AND pb."colorId" IS NOT DISTINCT FROM v."colorId"`,
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
    const { status } = searchOrderDto;

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

    const result = await paginateQuery(
      qb,
      'order',
      searchOrderDto,
      SORTABLE_COLUMNS,
      'createdAt',
    );

    // ⚠️ უსაფრთხოების ფიქსი: user.phoneNumber ზემოთ დეშიფრული სახით ირჩევა
    // (encryptedColumnTransformer ავტომატურად შიფრავს), მაგრამ ისევე, როგორც
    // AuthService.generateToken() masking იყენებს login/register პასუხში,
    // სიაშიც (მათ შორის GET /orders/admin/all) მხოლოდ ნიღბიანი ვერსია უნდა
    // გავცეთ — სრული ნომერი კონკრეტული შეკვეთის დეტალზეა საჭირო, არა სიაში.
    for (const order of result.data) {
      if (order.user) {
        order.user.phoneNumber = maskPhoneNumber(order.user.phoneNumber);
      }
    }

    return result;
  }
}
