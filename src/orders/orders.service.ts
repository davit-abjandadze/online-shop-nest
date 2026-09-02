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
import { Product } from '../products/entities/product.entity';
import { ProductColor } from '../products/entities/product-color.entity';
import { ProductBranch } from '../products/entities/product-branch.entity';
import { CartService } from '../cart/cart.service';
import { SearchOrderDto } from './dto/search-order.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { UserRole } from '../users/entities/user.entity';
import { BranchesService } from '../branches/branches.service';

// გადაუხდელი შეკვეთის default ვადა (წუთებში) — ამის შემდეგ cron (Phase 5)
// EXPIRED-ში გადაჰყავს და მარაგს აბრუნებს.
const DEFAULT_ORDER_TTL_MINUTES = 15;

const SORTABLE_COLUMNS = new Set(['id', 'status', 'totalAmount', 'createdAt']);

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
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
    const shippingAddress =
      deliveryMethod === DeliveryMethod.PICKUP
        ? branch!.address
        : createOrderDto.shippingAddress!;

    const cart = await this.cartService.getOrCreateForUser(userId);
    if (!cart.items?.length) {
      throw new BadRequestException('კალათა ცარიელია');
    }

    const orderId = await this.dataSource.transaction(async (manager) => {
      const orderItems: OrderItem[] = [];
      let totalAmount = 0;

      for (const cartItem of cart.items) {
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
            `პროდუქტი "${cartItem.product.name}" აღარ არსებობს`,
          );
        }

        // დეაქტივირებული პროდუქტი კალათაში შეიძლება უკვე იდებდეს (მანამდე
        // აქტიური იყო) — checkout-ზე ხელახლა ვამოწმებთ, რომ დეაქტივაციის
        // შემდეგ ყიდვა ვერ მოხდეს.
        if (!product.isActive) {
          throw new BadRequestException(
            `პროდუქტი "${product.name}" აღარ არის ხელმისაწვდომი`,
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
              `არჩეული ფერი პროდუქტისთვის "${product.name}" აღარ არსებობს`,
            );
          }
          if (productColor.stock < cartItem.quantity) {
            throw new BadRequestException(
              `მარაგში საკმარისი რაოდენობა არ არის ფერისთვის "${productColor.color.nameKa}" (ხელმისაწვდომია: ${productColor.stock})`,
            );
          }
          productColor.stock -= cartItem.quantity;
          await manager.save(productColor);
        } else if (product.stock < cartItem.quantity) {
          throw new BadRequestException(
            `მარაგში საკმარისი რაოდენობა არ არის პროდუქტისთვის "${product.name}" (ხელმისაწვდომია: ${product.stock})`,
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
              `პროდუქტი "${product.name}" ფილიალში "${branch!.title}" არ იყიდება`,
            );
          }
          if (productBranch.stock < cartItem.quantity) {
            throw new BadRequestException(
              `მარაგში საკმარისი რაოდენობა არ არის ფილიალში "${branch!.title}" პროდუქტისთვის "${product.name}" (ხელმისაწვდომია: ${productBranch.stock})`,
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
        totalAmount += unitPrice * cartItem.quantity;

        orderItems.push(
          manager.create(OrderItem, {
            product,
            productName: product.name,
            colorId: productColor?.colorId ?? null,
            colorName: productColor?.color.nameKa,
            unitPrice: unitPrice.toFixed(2),
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
    const order = await this.findOrderOrThrow(orderId);
    const isAdmin = role === UserRole.ADMIN;
    if (!isAdmin && order.user.id !== userId) {
      throw new ForbiddenException('ამ შეკვეთის ნახვის უფლება არ გაქვთ');
    }
    return order;
  }

  // ადმინის მიერ სტატუსის ცვლილება (ან მომავალში — Payments callback-იდან).
  // CANCELLED-ზე გადასვლისას ვაბრუნებთ მარაგს, თუ ჯერ არ იყო
  // CANCELLED/EXPIRED — თორემ დარეზერვებული stock სამუდამოდ დაიკარგება.
  async updateStatus(orderId: number, status: OrderStatus): Promise<Order> {
    const order = await this.findOrderOrThrow(orderId);

    const alreadyReleased =
      order.status === OrderStatus.CANCELLED ||
      order.status === OrderStatus.EXPIRED;

    if (status === OrderStatus.CANCELLED && !alreadyReleased) {
      await this.dataSource.transaction(async (manager) => {
        await this.restockOrderItems(manager, order);
        await manager.update(Order, orderId, { status });
      });
      return this.findOrderOrThrow(orderId);
    }

    order.status = status;
    return this.orderRepository.save(order);
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
        await this.restockOrderItems(manager, order);
        await manager.update(Order, order.id, { status: OrderStatus.EXPIRED });
      });
    }

    return staleOrders.length;
  }

  private async restockOrderItems(manager: EntityManager, order: Order) {
    for (const item of order.items) {
      if (!item.product) continue; // პროდუქტი უკვე წაშლილია — აღარაფერზე ვაბრუნებთ
      await manager
        .createQueryBuilder()
        .update(Product)
        .set({ stock: () => `stock + ${item.quantity}` })
        .where('id = :id', { id: item.product.id })
        .execute();

      // ფერზე გაფორმებული item-ისთვის კონკრეტული ProductColor.stock-საც
      // ვაბრუნებთ (თუ ეს ფერი შუალედში არ წაშლილა) — createFromCart-ის
      // იგივე დაკლების საპირისპირო მოქმედება.
      if (item.colorId) {
        await manager
          .createQueryBuilder()
          .update(ProductColor)
          .set({ stock: () => `stock + ${item.quantity}` })
          .where('productId = :productId AND colorId = :colorId', {
            productId: item.product.id,
            colorId: item.colorId,
          })
          .execute();
      }

      // pickup შეკვეთისთვის — createFromCart-ის ProductBranch.stock დაკლების
      // საპირისპირო მოქმედება (თუ ეს ფილიალი შუალედში არ წაშლილა).
      if (order.deliveryMethod === DeliveryMethod.PICKUP && order.branch) {
        await manager
          .createQueryBuilder()
          .update(ProductBranch)
          .set({ stock: () => `stock + ${item.quantity}` })
          .where('productId = :productId AND branchId = :branchId', {
            productId: item.product.id,
            branchId: order.branch.id,
          })
          .execute();
      }
    }
  }

  private async findOrderOrThrow(orderId: number): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: { items: { product: true }, user: true, branch: true },
      // password/etc. აქ არ გვჭირდება — user მხოლოდ owner-ის ID-ის
      // შესამოწმებლადაა საჭირო, არ უნდა გავჟონოთ ჰეშირებული პაროლი კლიენტამდე.
      select: { user: { id: true } },
    });
    if (!order) {
      throw new NotFoundException(`შეკვეთა ID-ით ${orderId} ვერ მოიძებნა`);
    }
    return order;
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
      .addSelect(['user.id', 'user.firstName', 'user.lastName', 'user.email']);

    if (extra) {
      extra(qb);
    }

    if (status) {
      qb.andWhere('order.status = :status', { status });
    }

    const sortColumn = SORTABLE_COLUMNS.has(sortBy) ? sortBy : 'createdAt';
    qb.orderBy(`order.${sortColumn}`, order === 'ASC' ? 'ASC' : 'DESC');

    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return new PaginatedResponseDto(data, total, page, limit);
  }
}
