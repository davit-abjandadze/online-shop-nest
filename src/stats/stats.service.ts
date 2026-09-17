import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, LessThanOrEqual, Repository } from 'typeorm';
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
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { paginate } from '../common/utils/paginate.util';
import { GroupByDto, StatsDateRangeDto } from './dto/stats-date-range.dto';
import { DashboardOverviewDto } from './dto/dashboard-overview.dto';
import { RevenueOverTimeDto } from './dto/revenue-over-time.dto';
import {
  OrderStatusBreakdownDto,
  OrderStatusBreakdownItemDto,
} from './dto/order-status-breakdown.dto';
import { TopProductsQueryDto } from './dto/top-products-query.dto';
import { ProductStatDto } from './dto/product-stat.dto';
import { LowStockQueryDto } from './dto/low-stock-query.dto';
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

const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING,
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
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async getOverview(): Promise<DashboardOverviewDto> {
    const [
      todayRevenue,
      monthRevenue,
      activeOrdersCount,
      newUsersToday,
      lowStockCount,
    ] = await Promise.all([
      this.sumRevenueForCurrentBucket('day'),
      this.sumRevenueForCurrentBucket('month'),
      this.orderRepository.count({
        where: { status: In(ACTIVE_ORDER_STATUSES) },
      }),
      this.userRepository
        .createQueryBuilder('user')
        .where(
          `date_trunc('day', ${this.tbilisiFromNaiveUtc('"user"."createdAt"')}) = date_trunc('day', ${this.tbilisiFromInstant('NOW()')})`,
        )
        .getCount(),
      this.productRepository.count({
        where: {
          isActive: true,
          stock: LessThanOrEqual(LOW_STOCK_DEFAULT_THRESHOLD),
        },
      }),
    ]);

    return {
      todayRevenue,
      monthRevenue,
      activeOrdersCount,
      newUsersToday,
      lowStockCount,
    };
  }

  async getRevenueOverTime(dto: GroupByDto): Promise<RevenueOverTimeDto> {
    const groupBy = dto.groupBy ?? 'day';
    const { from, to } = this.resolveRange(dto);

    const rows = await this.orderRepository
      .createQueryBuilder('order')
      .select(
        `date_trunc(:groupBy, ${this.tbilisiFromNaiveUtc('"order"."createdAt"')})`,
        'bucket',
      )
      .addSelect('COALESCE(SUM(order.totalAmount), 0)', 'revenue')
      .where('order.status IN (:...statuses)', { statuses: REVENUE_STATUSES })
      .andWhere('order.createdAt BETWEEN :from AND :to', { from, to })
      .groupBy('bucket')
      .orderBy('bucket', 'ASC')
      .setParameter('groupBy', groupBy)
      .getRawMany<{ bucket: Date; revenue: string }>();

    const buckets = rows.map((row) => ({
      date: row.bucket.toISOString(),
      revenue: this.roundDecimal(row.revenue),
    }));
    const totalRevenue = buckets.reduce((sum, b) => sum + b.revenue, 0);

    // წინა, იგივე ხანგრძლივობის პერიოდი — [from - (to-from), from) —
    // changePercent-ის შედარებისთვის.
    const durationMs = to.getTime() - from.getTime();
    const previousFrom = new Date(from.getTime() - durationMs);
    const previousTo = from;
    const previousPeriodRevenue = await this.sumRevenueBetween(
      previousFrom,
      previousTo,
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
    dto: StatsDateRangeDto,
  ): Promise<OrderStatusBreakdownDto> {
    const { from, to } = this.resolveRange(dto);

    const rows = await this.orderRepository
      .createQueryBuilder('order')
      .select('order.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('order.createdAt BETWEEN :from AND :to', { from, to })
      .groupBy('order.status')
      .getRawMany<{ status: OrderStatus; count: string }>();

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

    // productId-ზე group-ი (არა oi.product join-ით) — წაშლილი პროდუქტების
    // (product FK SET NULL) ისტორიულ order_item-ებსაც უნდა ჩანდეს, productName
    // snapshot-იდანვე გვაქვს. "productId" raw-სვეტს ვიღებთ (არა oi.product),
    // რადგან OrderItem entity-ს productId ცალკე @Column-ად არ აქვს განსაზღვრული.
    const rows = await this.orderItemRepository
      .createQueryBuilder('oi')
      .innerJoin('oi.order', 'order')
      .select('oi."productId"', 'productId')
      .addSelect('oi.productName', 'productName')
      .addSelect('COALESCE(SUM(oi.quantity), 0)', 'quantitySold')
      .addSelect('COALESCE(SUM(oi.quantity * oi.unitPrice), 0)', 'revenue')
      .where('order.status IN (:...statuses)', { statuses: REVENUE_STATUSES })
      .andWhere('order.createdAt BETWEEN :from AND :to', { from, to })
      .groupBy('oi."productId"')
      .addGroupBy('oi.productName')
      .orderBy(sortBy === 'quantity' ? 'quantitySold' : 'revenue', order)
      .limit(limit)
      .getRawMany<{
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
  ): Promise<PaginatedResponseDto<Product>> {
    const threshold = dto.threshold ?? LOW_STOCK_DEFAULT_THRESHOLD;

    const qb = this.productRepository
      .createQueryBuilder('product')
      .where('product.isActive = true')
      .andWhere('product.stock <= :threshold', { threshold });

    return paginate(
      qb,
      'product',
      dto,
      LOW_STOCK_ALLOWED_SORT_COLUMNS,
      'stock',
    );
  }

  async getUserSignups(dto: GroupByDto): Promise<UserSignupsDto> {
    const groupBy = dto.groupBy ?? 'day';
    const { from, to } = this.resolveRange(dto);

    const rows = await this.userRepository
      .createQueryBuilder('user')
      .select(
        `date_trunc(:groupBy, ${this.tbilisiFromNaiveUtc('"user"."createdAt"')})`,
        'bucket',
      )
      .addSelect('COUNT(*)', 'count')
      .where('user.createdAt BETWEEN :from AND :to', { from, to })
      .groupBy('bucket')
      .orderBy('bucket', 'ASC')
      .setParameter('groupBy', groupBy)
      .getRawMany<{ bucket: Date; count: string }>();

    const buckets = rows.map((row) => ({
      date: row.bucket.toISOString(),
      count: parseInt(row.count, 10),
    }));
    const totalSignups = buckets.reduce((sum, b) => sum + b.count, 0);

    return { buckets, totalSignups };
  }

  async getCustomerLoyalty(
    dto: StatsDateRangeDto,
  ): Promise<CustomerLoyaltyDto> {
    const { from, to } = this.resolveRange(dto);

    // მხოლოდ რეალურად გადახდილი (REVENUE_STATUSES) შეკვეთები ითვლება
    // "შესყიდვად" — ჯერ არ დამთავრებული/გაუქმებული შეკვეთა მომხმარებელს
    // "მყიდველად" არ აქცევს.
    const rows = await this.orderRepository
      .createQueryBuilder('order')
      .innerJoin('order.user', 'user')
      .select('user.id', 'userId')
      .addSelect('COUNT(*)', 'orderCount')
      .where('order.status IN (:...statuses)', { statuses: REVENUE_STATUSES })
      .andWhere('order.createdAt BETWEEN :from AND :to', { from, to })
      .groupBy('user.id')
      .getRawMany<{ userId: number; orderCount: string }>();

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

  async getPaymentStats(dto: StatsDateRangeDto): Promise<PaymentStatsDto> {
    const { from, to } = this.resolveRange(dto);

    const rows = await this.paymentRepository
      .createQueryBuilder('payment')
      .select('payment.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('payment.createdAt BETWEEN :from AND :to', { from, to })
      .groupBy('payment.status')
      .getRawMany<{ status: PaymentStatus; count: string }>();

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

  async getBranchSales(dto: StatsDateRangeDto): Promise<BranchSalesDto> {
    const { from, to } = this.resolveRange(dto);

    // მხოლოდ PICKUP შეკვეთები — courier შეკვეთებს branch საერთოდ არ აქვთ
    // მინიჭებული (იხ. Order.branch).
    const rows = await this.orderRepository
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
      .andWhere('order.createdAt BETWEEN :from AND :to', { from, to })
      .groupBy('branch.id')
      .addGroupBy('branch.title')
      .getRawMany<{
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
    dto: StatsDateRangeDto,
  ): Promise<StatusTransitionAvgDto> {
    const { from, to } = this.resolveRange(dto);

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
      GROUP BY "prevStatus", status
      ORDER BY "prevStatus", status`,
      [from, to],
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
  ): Promise<number> {
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

  private async sumRevenueBetween(from: Date, to: Date): Promise<number> {
    const result = await this.orderRepository
      .createQueryBuilder('order')
      .select('COALESCE(SUM(order.totalAmount), 0)', 'sum')
      .where('order.status IN (:...statuses)', { statuses: REVENUE_STATUSES })
      .andWhere('order.createdAt BETWEEN :from AND :to', { from, to })
      .getRawOne<{ sum: string }>();
    return this.roundDecimal(result?.sum);
  }

  private resolveRange(dto: StatsDateRangeDto): { from: Date; to: Date } {
    const to = dto.to ? new Date(dto.to) : new Date();
    const from = dto.from
      ? new Date(dto.from)
      : new Date(to.getTime() - DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000);
    return { from, to };
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
