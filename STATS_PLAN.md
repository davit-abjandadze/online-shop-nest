# Admin Stats/Analytics Module — Implementation Plan

## კონტექსტი

ადმინ პანელისთვის სჭირდება სტატისტიკების ბლოკი — შემოსავალი, შეკვეთების სტატუსები, ტოპ პროდუქტები,
low-stock, ახალი მომხმარებლები, გადახდების success rate, ფილიალების გაყიდვები. ეს ყველაფერი აიგება
არსებული ცხრილების (`order`, `order_item`, `order_status_history`, `payment`, `product`, `user`, `branch`)
თავზე, ახალი ცხრილების გარეშე — მხოლოდ read-only აგრეგაციული queries. `OrdersService`-ში უკვე დამკვიდრებული
პატერნია `@InjectDataSource()` + QueryBuilder-ის გამოყენება აგრეგაციისთვის, ამას გავყვებით.

დაზუსტებული გადაწყვეტილებები:
- bucketing დროის ზონა — **Asia/Tbilisi**
- "აქტიური შეკვეთები" overview-ში — **PENDING + PROCESSING**
- ტოპ-პროდუქტების endpoint — **flat სია + limit** (არა paginated)

## Module structure

```
src/stats/
  stats.module.ts
  stats.controller.ts
  stats.service.ts
  dto/
    stats-date-range.dto.ts      # StatsDateRangeDto (from/to) + GroupByDto (day|week|month)
    dashboard-overview.dto.ts
    revenue-over-time.dto.ts
    order-status-breakdown.dto.ts
    status-transition-avg.dto.ts
    top-products-query.dto.ts
    product-stat.dto.ts
    low-stock-query.dto.ts
    user-signups.dto.ts
    customer-loyalty.dto.ts
    payment-stats.dto.ts
    branch-sales.dto.ts
```

`StatsModule` → `TypeOrmModule.forFeature([Order, OrderItem, OrderStatusHistory, Payment, Product, User])`,
რეგისტრირდება `src/app.module.ts`-ში. `StatsService` იღებს repositories პირდაპირ (`@InjectRepository`) —
**არ** უნდა importირდეს `OrdersModule`/`ProductsModule`/`UsersModule`/`PaymentsModule`.

ყველა route `@AdminOnly()`-ის ქვეშ, `@ApiTags('Stats')`, ქართული `@ApiOperation` აღწერები.

## Shared DTOs

- **`StatsDateRangeDto`**: `from?`, `to?` (`@IsOptional() @IsDateString()`). Default: `to`=ახლა, `from`=ახლა-30დღე.
- **`GroupByDto`**: `groupBy?: 'day'|'week'|'month'` (`@IsIn`, default `'day'`).
- ყველა `date_trunc` bucketing → `AT TIME ZONE 'Asia/Tbilisi'` (მუდმივა `TBILISI_TZ`).
- Decimal ველების (`totalAmount`, `unitPrice`) აგრეგაცია → `getRawMany/One` აბრუნებს string-ებს, სერვისში
  `parseFloat` + დამრგვალება 2 ათწილადამდე.

---

## Phase 1 — ბირთვი (skeleton + core dashboard) ✅ დასრულებულია

- [x] 1.1 `stats.module.ts` / `stats.controller.ts` / `stats.service.ts` skeleton, რეგისტრაცია `app.module.ts`-ში
- [x] 1.2 `StatsDateRangeDto` + `GroupByDto` (`dto/stats-date-range.dto.ts`)
- [x] 1.3 `GET /stats/overview` — todayRevenue, monthRevenue, activeOrdersCount (PENDING+PROCESSING),
      newUsersToday, lowStockCount (`Promise.all`)
- [x] 1.4 `GET /stats/revenue?from&to&groupBy` — bucketed revenue + `previousPeriodRevenue`/`changePercent`
- [x] 1.5 `GET /stats/orders/status-breakdown?from&to` — count per `OrderStatus`, ნულოვანი enum შევსება
- [x] 1.6 ინდექსების migration `src/migrations/1788030000000-AddStatsIndexes.ts`:
      - `order.createdAt`
      - `order_status_history (order_id, created_at)` composite
      + შესაბამისი `@Index()` დეკორატორები entity-ებზე
- [x] 1.7 ვერიფიკაცია: `yarn build` ✅, `yarn lint` ✅ (მხოლოდ ახალ stats/ ფაილებზე — 0 ახალი
      გაფრთხილება/შეცდომა; დანარჩენი lint errors კოდბაზაში წინასწარვე არსებული იყო), `yarn test` ✅
      (9/9). სამივე endpoint რეალურ Postgres-ზე (`StatsService` NestJS `ApplicationContext`-იდან,
      forged JWT-ის გარეშე) გატესტილია და სწორ, დამრგვალებულ number-ებს აბრუნებს
      (string-კონკატენაცია არ ხდება — bucket-ების ჯამი ზუსტად `totalRevenue`-ს ემთხვევა).
      Unauthenticated მოთხოვნაზე (`curl /stats/overview` ტოკენის გარეშე) — 401 დადასტურებულია.

## Phase 2 — პროდუქტები ✅ დასრულებულია

- [x] 2.1 `GET /stats/products/top-selling?sortBy=revenue|quantity&order=DESC&limit=10&from&to` — flat,
      group by `oi.productName` + `oi.product` (წაშლილი პროდუქტებიც ჩანდეს)
- [x] 2.2 `GET /stats/products/low-stock?threshold&page&limit&sortBy&order` — **paginated**, `paginate()`
      util + `PaginatedResponseDto`, default sort `stock ASC`
- [x] 2.3 ვერიფიკაცია: `yarn build` ✅, `yarn lint` ✅ (0 ახალი error/warning `stats/`-ში), `yarn test` ✅
      (9/9). ორივე endpoint რეალურ Postgres-ზე (`StatsService` NestJS `ApplicationContext`-იდან)
      გატესტილია: top-selling სწორად იჯგუფება productId-ით (snapshot `productName`-ითურთ), `revenue`-ითა
      და `quantity`-ით დალაგება ორივე სწორია (`quantitySold`/`revenue` აღწერით კლებადობით
      გადამოწმებულია), low-stock default threshold=5-ით `stock ASC`-ით სწორად ბრუნდება
      (0, 0, 5), threshold=100000-ით `total` მკვეთრად იზრდება (79) — paginate()-ის total/meta
      სწორია. Unauthenticated მოთხოვნებზე (`curl` ორივე ახალ route-ზე ტოკენის გარეშე) — 401
      დადასტურებულია.

## Phase 3 — მომხმარებლები, გადახდები, ფილიალები ✅ დასრულებულია

- [x] 3.1 `GET /stats/users/signups?from&to&groupBy` — bucketed signup count (`UserSignupsDto`,
      `revenue-over-time`-ის იგივე bucketing პატერნი `user.createdAt`-ზე)
- [x] 3.2 `GET /stats/users/loyalty?from&to` — `order.user`-ზე `innerJoin` + `GROUP BY user.id`,
      მხოლოდ `REVENUE_STATUSES` შეკვეთები ითვლება "შესყიდვად"; `repeatCustomers` (≥2 შეკვეთა) vs
      `oneTimeCustomers` (ზუსტად 1) + `repeatRatePercent` (`null`, თუ პერიოდში მყიდველი არავინაა)
- [x] 3.3 `GET /stats/payments?from&to` — `PaymentStatus`-ის სრული breakdown (ნულოვანი enum
      შევსებით, `order-status-breakdown`-ის იგივე მიდგომა) + `successRatePercent`
      (`COMPLETED`/`total`, `null` თუ `total`=0)
- [x] 3.4 `GET /stats/branches/sales?from&to` — `orderRepository`-დან `innerJoin('order.branch', ...)`
      + `WHERE deliveryMethod = PICKUP AND status IN (...)`, შემდეგ ყველა ფილიალის (მათ შორის
      გაყიდვის არმქონეების, 0-ებით) merge `branchRepository.find()`-იდან, `sortOrder`-ით
      დალაგებული
- [x] 3.5 ვერიფიკაცია: `yarn build` ✅, `yarn lint` ✅ (0 ახალი error/warning `stats/`-ში —
      ყველა 78 lint error/18 warning კოდბაზაში წინასწარვე არსებობდა, არცერთი ახალ ფაილში),
      `yarn test` ✅ (9/9, რეგრესია არაა). ოთხივე endpoint რეალურ Postgres-ზე
      (`StatsService` NestJS `ApplicationContext`-იდან) გატესტილია: signups სწორად აჯგუფებს
      რეგისტრაციებს დღეების მიხედვით, loyalty სწორად ითვლის repeat/one-time თანაფარდობას
      (რეალურ მონაცემებში 1 repeat customer, 100% rate), payments success rate 84.6%-ს
      (11 completed / 13 სულ) სწორად აბრუნებს ყველა `PaymentStatus`-ის ნულოვანი
      შევსებით, branch-sales ორივე ფილიალს 0/0-ით აბრუნებს (მონაცემებში ამჟამად PICKUP+
      გადახდილი შეკვეთა არ არსებობს — ლოგიკურად სწორი ცარიელი შემთხვევა, crash-ის
      გარეშე). Unauthenticated მოთხოვნებზე (ოთხივე ახალ route) — 401 დადასტურებულია.

## Phase 4 — status-გადასვლების საშუალო დრო ✅ დასრულებულია

- [x] 4.1 `GET /stats/orders/transition-times?from&to` — `StatusTransitionAvgDto` (`dto/status-transition-avg.dto.ts`),
      `dataSource.query()`-ით raw SQL: `ordered` CTE (`LAG(status)`/`LAG("createdAt")
      OVER (PARTITION BY "orderId" ORDER BY "createdAt")` `order_status_history`-ზე) + გარე
      `GROUP BY (prevStatus, status)` საშუალო წამებზე (`AVG(EXTRACT(EPOCH FROM (...)))`) და
      `transitionCount`-ზე. `avgHumanReadable` — ქართული ფორმატერი (მაქს. ორი ერთეული, მაგ.
      "1 საათი 30 წუთი").
      **Caveat**: LAG() მთლიან, არაფილტრულ ისტორიაზე ითვლება per orderId და მხოლოდ გარე
      query-ში ვფილტრავთ *მომდევნო* (მოგვიანო) მოვლენის `createdAt`-ით — თუ `ordered` CTE-საც
      წინასწარ გავფილტრავდით from/to-ით, პერიოდის საზღვართან ახლოს მდგარი წყვილები (წინა
      მოვლენა საზღვრის გარეთ, მომდევნო — შიგნით) დაშლილიყო. ესე იგი `from`/`to` ეხება მხოლოდ
      გადასვლის *დასრულების* მომენტს, არა დასაწყისს — დოკუმენტირებულია `@ApiOperation.description`-ში.
- [x] 4.2 ვერიფიკაცია: `yarn build` ✅, `yarn lint` ✅ (0 ახალი error/warning `stats/`-ში — იგივე
      78 error/18 warning პრე-არსებული, stats-გარეთ), `yarn test` ✅ (9/9, რეგრესია არაა).
      Endpoint რეალურ Postgres-ზე (`StatsService` NestJS `ApplicationContext`-იდან) გატესტილია:
      ბოლო 365 დღეზე ყველა ხუთივე გადასვლა (pending→paid, pending→expired, paid→processing,
      processing→shipped, shipped→delivered) სწორი `transitionCount`/`avgSeconds`/
      `avgHumanReadable`-ით ბრუნდება; მომავალში (100-101 დღით წინ) ვიწრო ფანჯარა სწორად
      აბრუნებს ცარიელ `transitions`-ს crash-ის გარეშე. HTTP დონეზე (`yarn start` +
      unauthenticated `curl /stats/orders/transition-times`) — 401 დადასტურებულია, route
      (`GET /stats/orders/transition-times`) რეგისტრირებულია `RouterExplorer`-ის ლოგში.

---

## საერთო ვერიფიკაციის ჩეკლისტი (ყოველი ფაზის ბოლოს)

- [ ] `yarn build` + `yarn lint`
- [ ] Swagger UI-დან (`/api`) ტესტვა admin JWT-ით
- [ ] non-admin/unauthenticated → 401/403 დადასტურება
- [ ] არსებული ტესტების გავლა (`yarn test`)

## Critical files

- `src/stats/stats.service.ts`, `src/stats/stats.controller.ts`, `src/stats/stats.module.ts`
- `src/stats/dto/stats-date-range.dto.ts`
- `src/orders/entities/order.entity.ts`, `src/orders/entities/order-status-history.entity.ts`
- `src/common/utils/paginate.util.ts`, `src/common/dto/paginated-response.dto.ts`
- `src/migrations/<new>-AddStatsIndexes.ts`
- `src/app.module.ts` (StatsModule რეგისტრაცია)

---
