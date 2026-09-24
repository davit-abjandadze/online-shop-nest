import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import {
  Order,
  OrderStatus,
  DeliveryMethod,
} from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { Product } from '../products/entities/product.entity';
import { User } from '../users/entities/user.entity';
import { Payment, PaymentStatus } from '../payments/entities/payment.entity';
import { Branch } from '../branches/entities/branch.entity';
import { ProductColor } from '../products/entities/product-color.entity';
import { ProductVariant } from '../products/entities/product-variant.entity';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { paginate } from '../common/utils/paginate.util';
import {
  CompanyStatsRangeDto,
  GroupByDto,
  StatsDateRangeDto,
  StatsGroupBy,
} from './dto/stats-date-range.dto';
import { RevenueQueryDto } from './dto/revenue-query.dto';
import { DashboardOverviewDto } from './dto/dashboard-overview.dto';
import { OverviewQueryDto } from './dto/overview-query.dto';
import { RevenueOverTimeDto } from './dto/revenue-over-time.dto';
import {
  OrderStatusBreakdownDto,
  OrderStatusBreakdownItemDto,
} from './dto/order-status-breakdown.dto';
import { TopProductsQueryDto } from './dto/top-products-query.dto';
import { ProductStatDto } from './dto/product-stat.dto';
import { LowStockQueryDto } from './dto/low-stock-query.dto';
import { LowStockItemDto } from './dto/low-stock-product.dto';
import { UserSignupsDto } from './dto/user-signups.dto';
import { CustomerLoyaltyDto } from './dto/customer-loyalty.dto';
import {
  PaymentStatsDto,
  PaymentStatusBreakdownItemDto,
} from './dto/payment-stats.dto';
import { BranchSalesDto } from './dto/branch-sales.dto';
import {
  StatusTransitionAvgDto,
  StatusTransitionAvgItemDto,
} from './dto/status-transition-avg.dto';

// ბუქეთინგისა (date_trunc) და "დღეს"/"ამ თვის" საზღვრების გამოთვლის
// დროის ზონა — ადმინები საქართველოდანაა, კალენდარული "დღეს" თბილისის
// დროის მიხედვით უნდა ითვლებოდეს, არა UTC-ის მიხედვით.
export const TBILISI_TZ = 'Asia/Tbilisi';

// შემოსავალში ითვლება მხოლოდ ის შეკვეთები, რომლებიც გადახდის ეტაპს
// მიაღწიეს — PENDING (ჯერ არაა გადახდილი) და CANCELLED/EXPIRED (არასდროს
// გადახდილა, ან თანხა უკვე დაბრუნებულია) გამორიცხულია.
const REVENUE_STATUSES: OrderStatus[] = [
  OrderStatus.PAID,
  OrderStatus.PROCESSING,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
];

// PAID — გადახდილია და ადმინის დამუშავებას ელოდება, ამიტომ აქტიურადაც ითვლება.
const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.PAID,
  OrderStatus.PROCESSING,
];

// Phase 2-ის /stats/products/low-stock endpoint-ის იგივე default threshold —
// overview-ის lowStockCount მისი "swagger-ის ერთი რიცხვი" შემოკლებული ვერსიაა.
const LOW_STOCK_DEFAULT_THRESHOLD = 5;

// GET /stats/products/low-stock-ისთვის დაშვებული sortBy სვეტების allow-list —
// resolveSortColumn()-ს გადაეცემა paginate()-ის შიგნით, raw sortBy string-ის
// პირდაპირ QueryBuilder.orderBy()-ში ჩასმის (order-by injection) თავიდან ასაცილებლად.
const LOW_STOCK_ALLOWED_SORT_COLUMNS = ['stock', 'price', 'createdAt'] as const;

const DEFAULT_RANGE_DAYS = 30;

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TBILISI_UTC_OFFSET = '+04:00';

@Injectable()
export class StatsService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(ProductColor)
    private readonly productColorRepository: Repository<ProductColor>,
    @InjectRepository(ProductVariant)
    private readonly productVariantRepository: Repository<ProductVariant>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async getOverview(dto?: OverviewQueryDto): Promise<DashboardOverviewDto> {
    const { companyId } = dto ?? {};
    const [
      todayRevenue,
      monthRevenue,
      activeOrdersCount,
      newUsersToday,
      lowStockCount,
    ] = await Promise.all([
      this.sumRevenueForCurrentBucket('day', companyId),
      this.sumRevenueForCurrentBucket('month', companyId),
      this.countActiveOrders(companyId),
      this.userRepository
        .createQueryBuilder('user')
        .where(
          `date_trunc('day', ${this.tbilisiFromNaiveUtc('"user"."createdAt"')}) = date_trunc('day', ${this.tbilisiFromInstant('NOW()')})`,
        )
        .getCount(),
      this.lowStockProductsQuery(
        LOW_STOCK_DEFAULT_THRESHOLD,
        companyId,
      ).getCount(),
    ]);

    return {
      todayRevenue,
      monthRevenue,
      activeOrdersCount,
      newUsersToday,
      lowStockCount,
    };
  }

  async getRevenueOverTime(dto: RevenueQueryDto): Promise<RevenueOverTimeDto> {
    const groupBy = dto.groupBy ?? 'day';
    const { from, to } = this.resolveRange(dto);
    const { companyId } = dto;

    // company-ით ფილტრი order.totalAmount-ზე შეუძლებელია — company მხოლოდ
    // Product-ზეა მიბმული, ერთ order-ში სხვადასხვა კომპანიის პროდუქტი
    // შეიძლება იყოს. ამიტომ ეს ყოველთვის OrderItem.companyId snapshot-ზე
    // (და unitPrice*quantity-ის ჯამზე) აგრეგირდება, არა order.totalAmount-ზე
    // — company-ფილტრის გარეშეც იგივე ჯამს იძლევა, რადგან totalAmount თავად
    // per-line დამრგვალებული თანხების ჯამია (იხ. OrdersService).
    const qb = this.orderItemRepository
      .createQueryBuilder('oi')
      .innerJoin('oi.order', 'order')
      .select(
        `date_trunc(:groupBy, ${this.tbilisiFromNaiveUtc('"order"."createdAt"')})`,
        'bucket',
      )
      .addSelect('COALESCE(SUM(oi.quantity * oi.unitPrice), 0)', 'revenue')
      .where('order.status IN (:...statuses)', { statuses: REVENUE_STATUSES })
      .andWhere(
        'order.createdAt BETWEEN :from AND :to',
        this.rangeParams(from, to),
      )
      .groupBy('bucket')
      .orderBy('bucket', 'ASC')
      .setParameter('groupBy', groupBy);

    if (companyId) {
      qb.andWhere('oi.companyId = :companyId', { companyId });
    }

    const [rows, series] = await Promise.all([
      qb.getRawMany<{ bucket: Date; revenue: string }>(),
      this.getBucketSeries(groupBy, from, to),
    ]);

    // ცარიელი (შეკვეთის არმქონე) bucket-ები 0-ით ივსება — წინააღმდეგ
    // შემთხვევაში გრაფიკი მათ უბრალოდ გამოტოვებდა და ფრონტზე bucket-ზე
    // საშუალოს დათვლა (totalRevenue / buckets.length) არასწორი იქნებოდა.
    const revenueByBucket = new Map(
      rows.map((row) => [row.bucket.getTime(), this.roundDecimal(row.revenue)]),
    );
    const buckets = series.map((bucket) => ({
      date: bucket.toISOString(),
      revenue: revenueByBucket.get(bucket.getTime()) ?? 0,
    }));
    const totalRevenue =
      Math.round(buckets.reduce((sum, b) => sum + b.revenue, 0) * 100) / 100;

    // წინა, იგივე ხანგრძლივობის პერიოდი — [from - (to-from), from) —
    // changePercent-ის შედარებისთვის.
    const durationMs = to.getTime() - from.getTime();
    // BETWEEN ორივე მხრიდან ჩათვლითია — previousTo = from - 1ms, რომ
    // საზღვარზე მდგარი შეკვეთა ორივე პერიოდში არ ჩაითვალოს.
    const previousFrom = new Date(from.getTime() - durationMs);
    const previousTo = new Date(from.getTime() - 1);
    const previousPeriodRevenue = await this.sumRevenueBetween(
      previousFrom,
      previousTo,
      companyId,
    );

    const changePercent =
      previousPeriodRevenue === 0
        ? null
        : Math.round(
            ((totalRevenue - previousPeriodRevenue) / previousPeriodRevenue) *
              1000,
          ) / 10;

    return { buckets, totalRevenue, previousPeriodRevenue, changePercent };
  }

  async getOrderStatusBreakdown(
    dto: CompanyStatsRangeDto,
  ): Promise<OrderStatusBreakdownDto> {
    const { from, to } = this.resolveRange(dto);
    const { companyId } = dto;

    const qb = this.orderRepository
      .createQueryBuilder('order')
      .select('order.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where(
        'order.createdAt BETWEEN :from AND :to',
        this.rangeParams(from, to),
      )
      .groupBy('order.status');

    if (companyId) {
      qb.andWhere(this.orderHasCompanyItemSql('"order"."id"'), { companyId });
    }

    const rows = await qb.getRawMany<{ status: OrderStatus; count: string }>();

    const counts = new Map(rows.map((r) => [r.status, parseInt(r.count, 10)]));

    // ყველა OrderStatus წევრი ყოველთვის ვცემთ, count: 0-ითაც — ფრონტს არ
    // სჭირდება enum-ის sparse-სიის დამატებით შემოწმება (მაგ. chart-ის
    // ცარიელი slice-ები).
    const breakdown: OrderStatusBreakdownItemDto[] = Object.values(
      OrderStatus,
    ).map((status) => ({ status, count: counts.get(status) ?? 0 }));

    const total = breakdown.reduce((sum, b) => sum + b.count, 0);

    return { breakdown, total };
  }

  async getTopSellingProducts(
    dto: TopProductsQueryDto,
  ): Promise<ProductStatDto[]> {
    const sortBy = dto.sortBy ?? 'revenue';
    const order = dto.order ?? 'DESC';
    const limit = dto.limit ?? 10;
    const { from, to } = this.resolveRange(dto);
    const { companyId } = dto;

    // productId-ზე group-ი (არა oi.product join-ით) — წაშლილი პროდუქტების
    // (product FK SET NULL) ისტორიულ order_item-ებსაც უნდა ჩანდეს, productName
    // snapshot-იდანვე გვაქვს. "productId" raw-სვეტს ვიღებთ (არა oi.product),
    // რადგან OrderItem entity-ს productId ცალკე @Column-ად არ აქვს განსაზღვრული.
    // productName-ით მხოლოდ წაშლილ (productId NULL) პროდუქტებს ვყოფთ — არსებულ
    // პროდუქტს სახელის შეცვლის შემდეგ ორ ხაზად რომ არ დაეშალოს. სახელად ყველაზე
    // ბოლო შეკვეთის snapshot-ს ვიღებთ (ცოცხალი სახელი translations-შია).
    const qb = this.orderItemRepository
      .createQueryBuilder('oi')
      .innerJoin('oi.order', 'order')
      .select('oi."productId"', 'productId')
      .addSelect(
        '(ARRAY_AGG(oi.productName ORDER BY order.createdAt DESC, oi.id DESC))[1]',
        'productName',
      )
      .addSelect('COALESCE(SUM(oi.quantity), 0)', 'quantitySold')
      .addSelect('COALESCE(SUM(oi.quantity * oi.unitPrice), 0)', 'revenue')
      .where('order.status IN (:...statuses)', { statuses: REVENUE_STATUSES })
      .andWhere(
        'order.createdAt BETWEEN :from AND :to',
        this.rangeParams(from, to),
      )
      .groupBy('oi."productId"')
      .addGroupBy('CASE WHEN oi."productId" IS NULL THEN oi.productName END')
      .orderBy(sortBy === 'quantity' ? 'quantitySold' : 'revenue', order)
      .limit(limit);

    if (companyId) {
      qb.andWhere('oi.companyId = :companyId', { companyId });
    }

    const rows = await qb.getRawMany<{
      productId: number | string | null;
      productName: string;
      quantitySold: string;
      revenue: string;
    }>();

    return rows.map((row) => ({
      productId: row.productId === null ? null : Number(row.productId),
      productName: row.productName,
      quantitySold: parseInt(row.quantitySold, 10),
      revenue: this.roundDecimal(row.revenue),
    }));
  }

  async getLowStockProducts(
    dto: LowStockQueryDto,
  ): Promise<
    PaginatedResponseDto<Product & { lowStockItems: LowStockItemDto[] }>
  > {
    const threshold = dto.threshold ?? LOW_STOCK_DEFAULT_THRESHOLD;

    const result = await paginate(
      this.lowStockProductsQuery(threshold, dto.companyId),
      'product',
      dto,
      LOW_STOCK_ALLOWED_SORT_COLUMNS,
      'stock',
    );

    // მიმდინარე გვერდის პროდუქტების კონკრეტული დაბალი მარაგის ფერები/ზომები —
    // ფრონტზე ჩანდეს, კონკრეტულად რომელი ფერი/ზომა იწურება.
    const productIds = result.data.map((product) => product.id);
    const [colors, variants] = productIds.length
      ? await Promise.all([
          this.productColorRepository.find({
            where: { productId: In(productIds) },
            relations: { color: true },
          }),
          this.productVariantRepository.find({
            where: { productId: In(productIds) },
            relations: { color: true, size: true },
          }),
        ])
      : [[], []];

    const itemsByProductId = new Map<number, LowStockItemDto[]>();
    const pushItem = (productId: number, item: LowStockItemDto) => {
      const items = itemsByProductId.get(productId) ?? [];
      items.push(item);
      itemsByProductId.set(productId, items);
    };
    for (const pc of colors) {
      if (pc.stock > threshold) continue;
      pushItem(pc.productId, {
        type: 'color',
        id: pc.id,
        color: pc.color ?? null,
        size: null,
        stock: pc.stock,
      });
    }
    for (const pv of variants) {
      if (pv.stock > threshold) continue;
      pushItem(pv.productId, {
        type: 'variant',
        id: pv.id,
        color: pv.color ?? null,
        size: pv.size ?? null,
        stock: pv.stock,
      });
    }

    return {
      ...result,
      data: result.data.map((product) =>
        Object.assign(product, {
          lowStockItems: (itemsByProductId.get(product.id) ?? []).sort(
            (a, b) => a.stock - b.stock,
          ),
        }),
      ),
    };
  }

  // აქტიური პროდუქტი "დაბალი მარაგისაა", თუ მისი ჯამური stock, ან ნებისმიერი
  // ცალკეული ფერის (ProductColor) / ვარიანტის (ProductVariant — ფერი+ზომა)
  // stock threshold-ზე ნაკლები ან ტოლია — product.stock ფერების/ვარიანტების
  // ჯამია, ამიტომ მხოლოდ მასზე შემოწმება ამოწურულ ცალკეულ ფერს/ზომას მალავდა.
  // overview-ის lowStockCount და /stats/products/low-stock ერთსა და იმავე
  // პირობას იზიარებენ.
  private lowStockProductsQuery(threshold: number, companyId?: string) {
    const qb = this.productRepository
      .createQueryBuilder('product')
      .where('product.isActive = true')
      .andWhere(
        `(product.stock <= :threshold
          OR EXISTS (SELECT 1 FROM product_color pc_l WHERE pc_l."productId" = product.id AND pc_l.stock <= :threshold)
          OR EXISTS (SELECT 1 FROM product_variant pv_l WHERE pv_l."productId" = product.id AND pv_l.stock <= :threshold))`,
        { threshold },
      );

    if (companyId) {
      qb.andWhere('product."companyId" = :companyId', { companyId });
    }

    return qb;
  }

  async getUserSignups(dto: GroupByDto): Promise<UserSignupsDto> {
    const groupBy = dto.groupBy ?? 'day';
    const { from, to } = this.resolveRange(dto);

    const rowsQuery = this.userRepository
      .createQueryBuilder('user')
      .select(
        `date_trunc(:groupBy, ${this.tbilisiFromNaiveUtc('"user"."createdAt"')})`,
        'bucket',
      )
      .addSelect('COUNT(*)', 'count')
      .where('user.createdAt BETWEEN :from AND :to', this.rangeParams(from, to))
      .groupBy('bucket')
      .orderBy('bucket', 'ASC')
      .setParameter('groupBy', groupBy)
      .getRawMany<{ bucket: Date; count: string }>();

    const [rows, series] = await Promise.all([
      rowsQuery,
      this.getBucketSeries(groupBy, from, to),
    ]);

    // getRevenueOverTime-ის იგივე მიდგომა — რეგისტრაციის არმქონე bucket-ები
    // 0-ით ივსება, რომ გრაფიკი ცარიელ დღეებს არ "აწებებდეს" და ღერძი
    // შემოსავლის გრაფიკს ემთხვეოდეს.
    const countByBucket = new Map(
      rows.map((row) => [row.bucket.getTime(), parseInt(row.count, 10)]),
    );
    const buckets = series.map((bucket) => ({
      date: bucket.toISOString(),
      count: countByBucket.get(bucket.getTime()) ?? 0,
    }));
    const totalSignups = buckets.reduce((sum, b) => sum + b.count, 0);

    return { buckets, totalSignups };
  }

  async getCustomerLoyalty(
    dto: CompanyStatsRangeDto,
  ): Promise<CustomerLoyaltyDto> {
    const { from, to } = this.resolveRange(dto);
    const { companyId } = dto;

    // მხოლოდ რეალურად გადახდილი (REVENUE_STATUSES) შეკვეთები ითვლება
    // "შესყიდვად" — ჯერ არ დამთავრებული/გაუქმებული შეკვეთა მომხმარებელს
    // "მყიდველად" არ აქცევს.
    const qb = this.orderRepository
      .createQueryBuilder('order')
      .innerJoin('order.user', 'user')
      .select('user.id', 'userId')
      .addSelect('COUNT(*)', 'orderCount')
      .where('order.status IN (:...statuses)', { statuses: REVENUE_STATUSES })
      .andWhere(
        'order.createdAt BETWEEN :from AND :to',
        this.rangeParams(from, to),
      )
      .groupBy('user.id');

    if (companyId) {
      qb.andWhere(this.orderHasCompanyItemSql('"order"."id"'), { companyId });
    }

    const rows = await qb.getRawMany<{ userId: number; orderCount: string }>();

    let repeatCustomers = 0;
    let oneTimeCustomers = 0;
    for (const row of rows) {
      if (parseInt(row.orderCount, 10) >= 2) {
        repeatCustomers += 1;
      } else {
        oneTimeCustomers += 1;
      }
    }

    const totalCustomers = repeatCustomers + oneTimeCustomers;
    const repeatRatePercent =
      totalCustomers === 0
        ? null
        : Math.round((repeatCustomers / totalCustomers) * 1000) / 10;

    return { repeatCustomers, oneTimeCustomers, repeatRatePercent };
  }

  async getPaymentStats(dto: CompanyStatsRangeDto): Promise<PaymentStatsDto> {
    const { from, to } = this.resolveRange(dto);
    const { companyId } = dto;

    const qb = this.paymentRepository
      .createQueryBuilder('payment')
      .select('payment.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where(
        'payment.createdAt BETWEEN :from AND :to',
        this.rangeParams(from, to),
      )
      .groupBy('payment.status');

    if (companyId) {
      qb.andWhere(this.orderHasCompanyItemSql('"payment"."orderId"'), {
        companyId,
      });
    }

    const rows = await qb.getRawMany<{
      status: PaymentStatus;
      count: string;
    }>();

    const counts = new Map(rows.map((r) => [r.status, parseInt(r.count, 10)]));

    // OrderStatusBreakdown-ის იგივე მიდგომა — ყველა PaymentStatus წევრი
    // count: 0-ითაც კი წარმოდგენილია.
    const breakdown: PaymentStatusBreakdownItemDto[] = Object.values(
      PaymentStatus,
    ).map((status) => ({ status, count: counts.get(status) ?? 0 }));

    const total = breakdown.reduce((sum, b) => sum + b.count, 0);
    const completedCount = counts.get(PaymentStatus.COMPLETED) ?? 0;
    const successRatePercent =
      total === 0 ? null : Math.round((completedCount / total) * 1000) / 10;

    return { breakdown, total, successRatePercent };
  }

  async getBranchSales(dto: CompanyStatsRangeDto): Promise<BranchSalesDto> {
    const { from, to } = this.resolveRange(dto);
    const { companyId } = dto;

    // მხოლოდ PICKUP შეკვეთები — courier შეკვეთებს branch საერთოდ არ აქვთ
    // მინიჭებული (იხ. Order.branch).
    // companyId-ით — მხოლოდ ამ კომპანიის ფილიალები (Branch.companyId).
    const qb = this.orderRepository
      .createQueryBuilder('order')
      .innerJoin('order.branch', 'branch')
      .select('branch.id', 'branchId')
      .addSelect('branch.title', 'branchTitle')
      .addSelect('COUNT(*)', 'orderCount')
      .addSelect('COALESCE(SUM(order.totalAmount), 0)', 'revenue')
      .where('order.status IN (:...statuses)', { statuses: REVENUE_STATUSES })
      .andWhere('order.deliveryMethod = :deliveryMethod', {
        deliveryMethod: DeliveryMethod.PICKUP,
      })
      .andWhere(
        'order.createdAt BETWEEN :from AND :to',
        this.rangeParams(from, to),
      )
      .groupBy('branch.id')
      .addGroupBy('branch.title');

    if (companyId) {
      qb.andWhere('branch.companyId = :companyId', { companyId });
    }

    const rows = await qb.getRawMany<{
      branchId: number;
      branchTitle: string;
      orderCount: string;
      revenue: string;
    }>();

    const salesByBranchId = new Map(
      rows.map((row) => [
        row.branchId,
        {
          orderCount: parseInt(row.orderCount, 10),
          revenue: this.roundDecimal(row.revenue),
        },
      ]),
    );

    // ყველა (მათ შორის გაყიდვის არმქონე) ფილიალი ყოველთვის ჩნდება 0-ებით —
    // OrderStatusBreakdown-ის იგივე მიდგომა, sortOrder-ის მიხედვით.
    const allBranches = await this.branchRepository.find({
      where: companyId ? { companyId } : {},
      order: { sortOrder: 'ASC' },
    });

    const branches = allBranches.map((branch) => {
      const sale = salesByBranchId.get(branch.id);
      return {
        branchId: branch.id,
        branchTitle: branch.title,
        orderCount: sale?.orderCount ?? 0,
        revenue: sale?.revenue ?? 0,
      };
    });

    return { branches };
  }

  // შეკვეთის status-გადასვლების (pending→paid, paid→processing და ა.შ.)
  // საშუალო ხანგრძლივობა. LAG()-ს ვთვლით `ordered` CTE-ში მთლიან, არაფილტრულ
  // ისტორიაზე (per orderId) და მხოლოდ გარე SELECT-ში ვფილტრავთ მიმდინარე
  // (მოგვიანო) მოვლენის createdAt-ით პერიოდში — თუ LAG-ის input-საც
  // წინასწარვე from/to-ით დავფილტრავდით, პერიოდის საზღვართან ახლოს მდგარი
  // წყვილები (წინა მოვლენა საზღვრის გარეთ, მომდევნო — შიგნით) დაშლილიყო და
  // ის კონკრეტული გადასვლა დათვლიდან ამოვარდებოდა. ეს ნიშნავს, რომ
  // "პერიოდი" ეხება მხოლოდ გადასვლის დასრულების მომენტს — არა მის დასაწყისს.
  async getStatusTransitionTimes(
    dto: CompanyStatsRangeDto,
  ): Promise<StatusTransitionAvgDto> {
    const { from, to } = this.resolveRange(dto);
    const { from: fromParam, to: toParam } = this.rangeParams(from, to);

    const rows = await this.dataSource.query<
      {
        fromStatus: OrderStatus;
        toStatus: OrderStatus;
        avgSeconds: string;
        transitionCount: string;
      }[]
    >(
      `WITH ordered AS (
        SELECT
          "orderId",
          status,
          "createdAt",
          LAG(status) OVER (PARTITION BY "orderId" ORDER BY "createdAt") AS "prevStatus",
          LAG("createdAt") OVER (PARTITION BY "orderId" ORDER BY "createdAt") AS "prevCreatedAt"
        FROM order_status_history
      )
      SELECT
        "prevStatus" AS "fromStatus",
        status AS "toStatus",
        AVG(EXTRACT(EPOCH FROM ("createdAt" - "prevCreatedAt"))) AS "avgSeconds",
        COUNT(*) AS "transitionCount"
      FROM ordered
      WHERE "prevStatus" IS NOT NULL
        AND "createdAt" BETWEEN $1 AND $2
        AND (
          $3::uuid IS NULL
          OR EXISTS (
            SELECT 1 FROM order_item oi_c
            WHERE oi_c."orderId" = ordered."orderId" AND oi_c."companyId" = $3::uuid
          )
        )
      GROUP BY "prevStatus", status
      ORDER BY "prevStatus", status`,
      [fromParam, toParam, dto.companyId ?? null],
    );

    const transitions: StatusTransitionAvgItemDto[] = rows.map((row) => {
      const avgSeconds = Math.round(parseFloat(row.avgSeconds));
      return {
        fromStatus: row.fromStatus,
        toStatus: row.toStatus,
        avgSeconds,
        avgHumanReadable: this.formatDurationGeorgian(avgSeconds),
        transitionCount: parseInt(row.transitionCount, 10),
      };
    });

    return { transitions };
  }

  // წამებს გადაჰყავს ქართულ, ადამიანისთვის წაკითხვად ფორმატში (მაქს. ორი
  // ერთეული — მაგ. "2 დღე 3 საათი"), ჩარტის/ცხრილის tooltip-ისთვის.
  private formatDurationGeorgian(totalSeconds: number): string {
    const seconds = Math.max(0, Math.round(totalSeconds));
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const parts: string[] = [];
    if (days > 0) parts.push(`${days} დღე`);
    if (hours > 0) parts.push(`${hours} საათი`);
    if (minutes > 0) parts.push(`${minutes} წუთი`);
    if (parts.length === 0) parts.push(`${secs} წამი`);

    return parts.slice(0, 2).join(' ');
  }

  private async sumRevenueForCurrentBucket(
    period: 'day' | 'month',
    companyId?: string,
  ): Promise<number> {
    // companyId მოცემისას order.totalAmount-ს ვერ ვფილტრავთ (იხ.
    // getRevenueOverTime-ის კომენტარი) — OrderItem.companyId snapshot-ზე
    // დაფუძნებულ აგრეგაციაზე გადავდივართ, ისევე როგორც sumRevenueBetween-ში.
    if (companyId) {
      const result = await this.orderItemRepository
        .createQueryBuilder('oi')
        .innerJoin('oi.order', 'order')
        .select('COALESCE(SUM(oi.quantity * oi.unitPrice), 0)', 'sum')
        .where('order.status IN (:...statuses)', {
          statuses: REVENUE_STATUSES,
        })
        .andWhere(
          `date_trunc(:period, ${this.tbilisiFromNaiveUtc('"order"."createdAt"')}) = date_trunc(:period, ${this.tbilisiFromInstant('NOW()')})`,
          { period },
        )
        .andWhere('oi.companyId = :companyId', { companyId })
        .getRawOne<{ sum: string }>();
      return this.roundDecimal(result?.sum);
    }

    const result = await this.orderRepository
      .createQueryBuilder('order')
      .select('COALESCE(SUM(order.totalAmount), 0)', 'sum')
      .where('order.status IN (:...statuses)', { statuses: REVENUE_STATUSES })
      .andWhere(
        `date_trunc(:period, ${this.tbilisiFromNaiveUtc('"order"."createdAt"')}) = date_trunc(:period, ${this.tbilisiFromInstant('NOW()')})`,
        { period },
      )
      .getRawOne<{ sum: string }>();
    return this.roundDecimal(result?.sum);
  }

  // activeOrdersCount companyId-ით — შეკვეთა ითვლება, თუ მასში მოცემული
  // კომპანიის სულ ცოტა ერთი პროდუქტია (DISTINCT order.id, რადგან ერთ
  // შეკვეთაში ერთი კომპანიის რამდენიმე line-item შეიძლება იყოს).
  private async countActiveOrders(companyId?: string): Promise<number> {
    if (!companyId) {
      return this.orderRepository.count({
        where: { status: In(ACTIVE_ORDER_STATUSES) },
      });
    }

    const result = await this.orderRepository
      .createQueryBuilder('order')
      .innerJoin('order.items', 'oi')
      .where('order.status IN (:...statuses)', {
        statuses: ACTIVE_ORDER_STATUSES,
      })
      .andWhere('oi.companyId = :companyId', { companyId })
      .select('COUNT(DISTINCT order.id)', 'count')
      .getRawOne<{ count: string }>();
    return parseInt(result?.count ?? '0', 10);
  }

  private async sumRevenueBetween(
    from: Date,
    to: Date,
    companyId?: string,
  ): Promise<number> {
    // getRevenueOverTime-ის იგივე OrderItem-ზე დაფუძნებული აგრეგაცია —
    // companyId-ის ფილტრისთვის საჭირო, order.totalAmount-ს ვერ ვფილტრავთ
    // კომპანიის მიხედვით (იხ. getRevenueOverTime-ის კომენტარი).
    const qb = this.orderItemRepository
      .createQueryBuilder('oi')
      .innerJoin('oi.order', 'order')
      .select('COALESCE(SUM(oi.quantity * oi.unitPrice), 0)', 'sum')
      .where('order.status IN (:...statuses)', { statuses: REVENUE_STATUSES })
      .andWhere(
        'order.createdAt BETWEEN :from AND :to',
        this.rangeParams(from, to),
      );

    if (companyId) {
      qb.andWhere('oi.companyId = :companyId', { companyId });
    }

    const result = await qb.getRawOne<{ sum: string }>();
    return this.roundDecimal(result?.sum);
  }

  // [from, to] პერიოდის ყველა bucket-ის დასაწყისი (თბილისის დროით) —
  // date_trunc-ის იგივე ფორმატში, რასაც აგრეგაციის query-ები აბრუნებს,
  // რომ getTime()-ით შედარება (merge) სერვერის დროის ზონისგან დამოუკიდებელი იყოს.
  private async getBucketSeries(
    groupBy: StatsGroupBy,
    from: Date,
    to: Date,
  ): Promise<Date[]> {
    const rows = await this.dataSource.query<{ bucket: Date }[]>(
      `SELECT generate_series(
        date_trunc($1, ${this.tbilisiFromInstant('$2::timestamptz')}),
        date_trunc($1, ${this.tbilisiFromInstant('$3::timestamptz')}),
        ('1 ' || $1)::interval
      ) AS bucket`,
      [groupBy, from.toISOString(), to.toISOString()],
    );
    return rows.map((row) => row.bucket);
  }

  // ფრონტი თარიღებს "YYYY-MM-DD" ფორმატში აგზავნის (input type="date") —
  // `new Date('2026-09-24')` UTC შუაღამეა, რაც (1) თბილისის შუაღამეს 4
  // საათით აცდება და (2) `to`-ს შემთხვევაში მთელ ბოლო დღეს გამორიცხავს. ამიტომ
  // date-only მნიშვნელობა თბილისის კალენდარულ დღედ იკითხება: `from` — დღის
  // დასაწყისი, `to` — დღის ბოლო (ჩათვლით). სრული ISO datetime უცვლელად გადის.
  private resolveRange(dto: StatsDateRangeDto): { from: Date; to: Date } {
    const to = dto.to ? this.parseRangeBoundary(dto.to, 'end') : new Date();
    const from = dto.from
      ? this.parseRangeBoundary(dto.from, 'start')
      : new Date(to.getTime() - DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000);
    return { from, to };
  }

  private parseRangeBoundary(value: string, edge: 'start' | 'end'): Date {
    if (!DATE_ONLY_REGEX.test(value)) return new Date(value);
    // საქართველოში DST 2005 წლიდან აღარ მოქმედებს — ოფსეტი მუდმივად +04:00.
    const startOfDay = new Date(`${value}T00:00:00${TBILISI_UTC_OFFSET}`);
    return edge === 'start'
      ? startOfDay
      : new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);
  }

  // createdAt სვეტები naive UTC-ია (იხ. tbilisiFromNaiveUtc). JS Date-ს
  // პირდაპირ პარამეტრად გადაცემისას `pg` მას სერვერის ლოკალურ დროდ
  // (მაგ. +04:00) სერიალიზებს, Postgres კი `timestamp without time zone`-თან
  // შედარებისას ოფსეტს უგულებელყოფს — ფილტრი 4 საათით იწევს. toISOString()
  // ყოველთვის UTC wall-clock-ს აძლევს, რაც სვეტის შენახვის ფორმატს ემთხვევა.
  private rangeParams(from: Date, to: Date): { from: string; to: string } {
    return { from: from.toISOString(), to: to.toISOString() };
  }

  // შეკვეთა კომპანიას "ეკუთვნის", თუ მასში ამ კომპანიის სულ ცოტა ერთი
  // OrderItem-ია — EXISTS subquery (არა JOIN), რომ COUNT(*)/SUM-ები
  // line-item-ების რაოდენობით არ გამრავლდეს.
  private orderHasCompanyItemSql(orderIdExpr: string): string {
    return `EXISTS (SELECT 1 FROM order_item oi_c WHERE oi_c."orderId" = ${orderIdExpr} AND oi_c."companyId" = :companyId)`;
  }

  // order."createdAt"/user."createdAt" ბაზაში "timestamp without time zone"
  // ტიპისაა (@CreateDateColumn ცალკე ტიპის მითითების გარეშე) და ინახავს
  // UTC საათს naive (tz-ის გარეშე) მნიშვნელობად. ეს ორმაგი AT TIME ZONE —
  // ჯერ 'UTC'-ად ცხადდება (→ სწორი timestamptz momentum), მერე
  // 'Asia/Tbilisi'-ში გარდაიქმნება (→ naive local wall-clock) — სტანდარტული
  // trick naive-UTC სვეტების local-zone-ში bucketing-ისთვის.
  private tbilisiFromNaiveUtc(columnExpr: string): string {
    return `(${columnExpr} AT TIME ZONE 'UTC' AT TIME ZONE '${TBILISI_TZ}')`;
  }

  // NOW() (და ზოგადად ნებისმიერი "timestamp with time zone" გამოსახულება)
  // უკვე tz-informed-ია — მხოლოდ ერთი კონვერტაცია სჭირდება.
  private tbilisiFromInstant(instantExpr: string): string {
    return `(${instantExpr} AT TIME ZONE '${TBILISI_TZ}')`;
  }

  // decimal ველების getRawMany/getRawOne აბრუნებს string-ებს — parseFloat +
  // დამრგვალება 2 ათწილადამდე, რომ float-ის floating-point ხარვეზები
  // response-ში არ გამოჩნდეს.
  private roundDecimal(value: string | null | undefined): number {
    const parsed = parseFloat(value ?? '0');
    return Math.round(parsed * 100) / 100;
  }
}
