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
import { Order, OrderStatus } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { Product } from '../products/entities/product.entity';
import { CartService } from '../cart/cart.service';
import { SearchOrderDto } from './dto/search-order.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { UserRole } from '../users/entities/user.entity';

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
  ) {}

  // კალათიდან შეკვეთის შექმნა — ტრანზაქციაში, პროდუქტების row-level ლოქით
  // (pessimistic_write), რომ ორ პარალელურ checkout-ს ერთი და იმავე პროდუქტის
  // ბოლო ერთეულზე ორივემ ვერ გაიაროს stock-შემოწმება ერთდროულად.
  async createFromCart(
    userId: number,
    shippingAddress: string,
  ): Promise<Order> {
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
        if (product.stock < cartItem.quantity) {
          throw new BadRequestException(
            `მარაგში საკმარისი რაოდენობა არ არის პროდუქტისთვის "${product.name}" (ხელმისაწვდომია: ${product.stock})`,
          );
        }

        product.stock -= cartItem.quantity;
        await manager.save(product);

        const unitPrice = parseFloat(product.price);
        totalAmount += unitPrice * cartItem.quantity;

        orderItems.push(
          manager.create(OrderItem, {
            product,
            productName: product.name,
            unitPrice: product.price,
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
      relations: { items: { product: true } },
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
    }
  }

  private async findOrderOrThrow(orderId: number): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: { items: { product: true }, user: true },
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
