import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { StatsService } from './stats.service';
import { AdminOnly } from '../common/decorators/admin-only.decorator';
import { Product } from '../products/entities/product.entity';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { CompanyStatsRangeDto, GroupByDto } from './dto/stats-date-range.dto';
import { RevenueQueryDto } from './dto/revenue-query.dto';
import { DashboardOverviewDto } from './dto/dashboard-overview.dto';
import { OverviewQueryDto } from './dto/overview-query.dto';
import { RevenueOverTimeDto } from './dto/revenue-over-time.dto';
import { OrderStatusBreakdownDto } from './dto/order-status-breakdown.dto';
import { TopProductsQueryDto } from './dto/top-products-query.dto';
import { ProductStatDto } from './dto/product-stat.dto';
import { LowStockQueryDto } from './dto/low-stock-query.dto';
import { UserSignupsDto } from './dto/user-signups.dto';
import { CustomerLoyaltyDto } from './dto/customer-loyalty.dto';
import { PaymentStatsDto } from './dto/payment-stats.dto';
import { BranchSalesDto } from './dto/branch-sales.dto';
import { StatusTransitionAvgDto } from './dto/status-transition-avg.dto';

// ყველა route მხოლოდ ADMIN-ისთვისაა — StatsService სუფთა read-side
// აგრეგაციაა, ბიზნეს-მოდულებზე (OrdersModule და სხვ.) დამოკიდებულების
// გარეშე (იხ. STATS_PLAN.md).
@ApiTags('Stats')
@AdminOnly()
@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('overview')
  @ApiOperation({
    summary:
      'ადმინის დეშბორდის მთავარი მაჩვენებლები — ' +
      'ოფციონალურად companyId-ით კონკრეტული კომპანიის მიხედვით',
  })
  @ApiResponse({ status: 200, type: DashboardOverviewDto })
  getOverview(@Query() query: OverviewQueryDto): Promise<DashboardOverviewDto> {
    return this.statsService.getOverview(query);
  }

  @Get('revenue')
  @ApiOperation({
    summary:
      'შემოსავალი დროში (bucketed), წინა პერიოდთან შედარებით — ' +
      'ოფციონალურად companyId-ით კონკრეტული კომპანიის მიხედვით',
  })
  @ApiResponse({ status: 200, type: RevenueOverTimeDto })
  getRevenue(@Query() query: RevenueQueryDto): Promise<RevenueOverTimeDto> {
    return this.statsService.getRevenueOverTime(query);
  }

  @Get('orders/status-breakdown')
  @ApiOperation({ summary: 'შეკვეთების განაწილება სტატუსების მიხედვით' })
  @ApiResponse({ status: 200, type: OrderStatusBreakdownDto })
  getOrderStatusBreakdown(
    @Query() query: CompanyStatsRangeDto,
  ): Promise<OrderStatusBreakdownDto> {
    return this.statsService.getOrderStatusBreakdown(query);
  }

  @Get('products/top-selling')
  @ApiOperation({
    summary: 'ტოპ-გაყიდვადი პროდუქტები (flat სია, შემოსავლით ან რაოდენობით)',
  })
  @ApiResponse({ status: 200, type: [ProductStatDto] })
  getTopSellingProducts(
    @Query() query: TopProductsQueryDto,
  ): Promise<ProductStatDto[]> {
    return this.statsService.getTopSellingProducts(query);
  }

  @Get('products/low-stock')
  @ApiOperation({ summary: 'დაბალი მარაგის მქონე აქტიური პროდუქტები' })
  @ApiResponse({ status: 200, type: PaginatedResponseDto })
  getLowStockProducts(
    @Query() query: LowStockQueryDto,
  ): Promise<PaginatedResponseDto<Product>> {
    return this.statsService.getLowStockProducts(query);
  }

  @Get('users/signups')
  @ApiOperation({
    summary: 'ახალი მომხმარებლების რეგისტრაცია დროში (bucketed)',
  })
  @ApiResponse({ status: 200, type: UserSignupsDto })
  getUserSignups(@Query() query: GroupByDto): Promise<UserSignupsDto> {
    return this.statsService.getUserSignups(query);
  }

  @Get('users/loyalty')
  @ApiOperation({
    summary: 'მომხმარებელთა ლოიალობა — განმეორებითი vs ერთჯერადი მყიდველები',
  })
  @ApiResponse({ status: 200, type: CustomerLoyaltyDto })
  getCustomerLoyalty(
    @Query() query: CompanyStatsRangeDto,
  ): Promise<CustomerLoyaltyDto> {
    return this.statsService.getCustomerLoyalty(query);
  }

  @Get('payments')
  @ApiOperation({
    summary: 'გადახდების განაწილება სტატუსების მიხედვით + success rate',
  })
  @ApiResponse({ status: 200, type: PaymentStatsDto })
  getPaymentStats(
    @Query() query: CompanyStatsRangeDto,
  ): Promise<PaymentStatsDto> {
    return this.statsService.getPaymentStats(query);
  }

  @Get('branches/sales')
  @ApiOperation({
    summary:
      'ფილიალების გაყიდვები (მხოლოდ ფილიალიდან თვითგატანით შესრულებული შეკვეთები)',
  })
  @ApiResponse({ status: 200, type: BranchSalesDto })
  getBranchSales(
    @Query() query: CompanyStatsRangeDto,
  ): Promise<BranchSalesDto> {
    return this.statsService.getBranchSales(query);
  }

  @Get('orders/transition-times')
  @ApiOperation({
    summary: 'შეკვეთის სტატუს-გადასვლების საშუალო ხანგრძლივობა',
    description:
      'პერიოდის ფილტრი ეხება მხოლოდ თითოეული გადასვლის დასრულების მომენტს ' +
      '(არა დასაწყისს) — თუ გადასვლის წინა სტატუსი პერიოდის გარეთ მოხდა, ' +
      'ხოლო შემდეგი სტატუსი პერიოდში, ის მაინც ითვლება.',
  })
  @ApiResponse({ status: 200, type: StatusTransitionAvgDto })
  getStatusTransitionTimes(
    @Query() query: CompanyStatsRangeDto,
  ): Promise<StatusTransitionAvgDto> {
    return this.statsService.getStatusTransitionTimes(query);
  }
}
