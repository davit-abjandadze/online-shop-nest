# Plan 01 — Shop Domain: Products, Cart, Orders, Payments (BOG)

Status: proposed, not yet executed.
Scope: build the shop domain from scratch on top of the existing `auth` / `users` / `category` modules,
following the conventions documented in `CLAUDE.md` and observed in the current codebase. Payment provider:
Bank of Georgia (BOG) e-commerce API, integrated behind a swappable interface so TBC (or another provider)
can be added later without touching Orders.

Each phase below is self-contained enough to run in a fresh chat context: it restates the relevant
conventions, cites exact files/lines to copy from, and ends with a verification checklist.

Every phase's verification checklist is manual/exploratory (curl/psql/swagger-UI walkthroughs) — the only
`*.spec.ts` in this repo is the default Nest boilerplate `app.controller.spec.ts`; none of the existing
domain modules (`auth`/`users`/`category`) have their own tests, so there's no established per-module
unit-test convention to match. If that changes before this plan is executed, add a `*.spec.ts` alongside
each new `*.service.ts` covering at minimum the stock-race and cart/order edge cases the checklists already
describe, rather than only exercising them by hand.

---

## Phase 0 — Documentation Discovery (findings, already gathered)

### Allowed APIs / patterns to copy (from the existing codebase)

- **Bare-module CRUD pattern** — `src/category/`: `category.entity.ts`, `category.controller.ts`,
  `category.service.ts`, `category.module.ts`, `dto/create-category.dto.ts`,
  `dto/update-category.dto.ts` (`extends PartialType(CreateCategoryDto)`), `dto/category-response.dto.ts`.
  Copy this shape for every new module's skeleton.
- **Paginated list pattern** — `src/users/users.service.ts`'s `findAllPaginated`: `createQueryBuilder`,
  a `SORTABLE_COLUMNS` whitelist `Set` to guard `sortBy` against injection, `ILike` for free-text search,
  return `new PaginatedResponseDto(data, total, page, limit)`. Shared envelope classes live in
  `src/common/dto/pagination.dto.ts` (`PaginationDto`: `page`, `limit`, `sortBy = 'createdAt'`,
  `order: 'ASC'|'DESC' = 'DESC'`) and `src/common/dto/paginated-response.dto.ts`
  (`PaginatedResponseDto<T>` computing `totalPages`/`hasNext`/`hasPrevious`).
- **Auth/guard combo** — `src/users/users.controller.ts:35-51`:
  ```ts
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Controller('users')
  export class UsersController {
    @Post()
    @Roles(UserRole.ADMIN)
    async create(...) { ... }
  }
  ```
  `JwtAuthGuard` (`src/auth/jwt-auth.guard.ts`) must come first so `request.user` is populated for
  `RolesGuard` (`src/common/guards/roles.guard.ts`, reads `@Roles()` metadata via `Reflector`).
  `@CurrentUser()` (`src/common/decorators/current-user.decorator.ts`) pulls `request.user`, which has
  shape `{ userId, email, role }` — **note `userId`, not `id`** (`src/auth/jwt.strategy.ts`).
- **Enum-as-Postgres-column pattern** — `src/users/entities/user.entity.ts`:
  ```ts
  export enum UserRole { ADMIN = 'admin', USER = 'user' }
  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role: UserRole;
  ```
  Declare each new enum (`OrderStatus`, `PaymentStatus`, `PaymentProvider`) at the top of its owning
  entity file, same as `UserRole`/`Gender`, and validate it in DTOs with `@IsEnum(...)`.
- **Module wiring** — every new module needs `TypeOrmModule.forFeature([...])` + registration in
  `src/app.module.ts`'s `imports` array (currently `[UsersModule, AuthModule, CategoryModule]`).
- **Migrations** — `src/migrations/` is empty; `synchronize: true` outside production
  (`src/app.module.ts`) currently handles dev schema sync. CLI config lives in `src/data-source.ts`
  (separate `AppDataSource`, must stay in sync with `app.module.ts`'s entity/migration globs).
  `package.json` scripts: `migration:generate`, `migration:create`, `migration:run`, `migration:revert`.
  Each phase below ends by generating a real migration with `yarn migration:generate` so production
  (`synchronize: false`) has a real schema history — don't leave this to "later".
- **Validation/response conventions** — global `ValidationPipe({ whitelist: true, forbidNonWhitelisted:
  true, transform: true })` (`src/main.ts`), so every DTO field must be declared with class-validator
  decorators or the request is rejected. Responses are camelCase; no naming strategy remaps columns.

### Anti-patterns to avoid

- Don't invent TypeORM v0.3-style APIs (e.g. `repository.find({ where: {...} })` shorthand differences) —
  `package.json` pins `typeorm: ^1.1.0` under `@nestjs/typeorm ^11`, which CLAUDE.md flags as suspicious.
  **Check `node_modules/typeorm/package.json`'s actual installed version before writing repository code**,
  and mirror whatever API `category.service.ts`/`users.service.ts` already use rather than assuming.
- Don't add a Stripe SDK or any payment library not already in `package.json` — BOG has no official
  server-side SDK (see Payments phase); raw HTTP calls are the correct approach, not a guessed npm package.
- Don't wire payment callback verification loosely — BOG signs callbacks (`Callback-Signature` header,
  SHA256withRSA against the **raw** body). Skipping signature verification on the callback endpoint is a
  real vulnerability (anyone could POST a fake "completed" callback and mark an order paid for free).
- Don't put `@Roles(UserRole.ADMIN)` on customer-facing endpoints (browse products, view own cart/orders) —
  only admin mutation endpoints (create/update/delete product, list all orders) should be role-gated;
  everything else just needs `JwtAuthGuard` (or nothing, for public product browsing, matching how
  `category` currently has no guards at all).

### Confirmed BOG API facts (source: https://api.bog.ge/docs/en/payments/*)

- **Auth**: `POST https://oauth2.bog.ge/auth/realms/bog/protocol/openid-connect/token`,
  `Authorization: Basic base64(client_id:client_secret)`, form body `grant_type=client_credentials` →
  `{ access_token, token_type: "Bearer", expires_in }`. Cache the token in memory and refetch once
  `expires_in` elapses — don't hardcode a TTL, the field is authoritative.
- **Create order**: `POST https://api.bog.ge/payments/v1/ecommerce/orders`,
  `Authorization: Bearer <token>`, body includes `callback_url` (HTTPS, required), `external_order_id`,
  `purchase_units.basket[]` + `total_amount` + `currency` (default `GEL`), `redirect_urls.success`/`fail`,
  `ttl` (minutes, 2–1440, default 15), `payment_method[]` (e.g. `["card"]`).
  Response: `id` (BOG order id) and `_links.redirect.href` (`https://payment.bog.ge/?order_id={id}` —
  redirect the customer here).
- **Callback**: BOG POSTs to your `callback_url` on status change:
  `{ event: "order_payment", zoned_request_time, body: { order_status: { key }, ... } }`.
  `order_status.key` ∈ `created | processing | completed | rejected | refund_requested | refunded |
  refunded_partially | auth_requested | blocked | partial_completed`. Verified via `Callback-Signature`
  header (SHA256withRSA) against a documented RSA public key — **verify against raw body bytes before
  JSON-parsing**, field order affects the hash.
- **Get order status** (polling fallback): `GET https://api.bog.ge/payments/v1/receipt/{order_id}`,
  bearer auth, returns `order_status.key`, `payment_detail`, `actions[]`.
- **Sandbox test cards** (https://api.bog.ge/docs/en/sandbox/payments/test-cards): Visa
  `4000 0000 0000 0001` (success) / `...0002` (declined) / `...0003` (success-then-reject-on-refund); same
  pattern for Mastercard `5300...` and Amex `3700...`. Any future expiry + any CVV.
- **Gap to verify directly before implementing**: exact sandbox base URL (docs didn't surface a distinct
  hostname in this research pass — check https://api.bog.ge/docs/en/sandbox before hardcoding one).
- **No official server-side SDK exists** — `@bankofgeorgia/bog-payments-web-sdk` is a *frontend* widget
  package, not usable from NestJS. Use `@nestjs/axios`/plain `axios` for the server-side calls above.

---

## Phase 1 — Products module + Category linkage ✅ DONE (2026-08-20)

**What to implement**

1. `src/category/entities/category.entity.ts`: replace the `TODO` comment with a real relation:
   ```ts
   @OneToMany(() => Product, (product) => product.category)
   products?: Product[];
   ```
   (Use a string/lazy-safe import or `forwardRef` only if a circular import problem actually appears when
   both entities import each other — try the plain import first, matching how `User`/other entities in
   this codebase don't need `forwardRef` for simple relations.)
2. New module `src/products/` mirroring `src/category/`'s file layout exactly:
   - `entities/product.entity.ts`: `id`, `name`, `description?`, `price` (`@Column('decimal', { precision:
     10, scale: 2 })` — never `float` for money), `stock` (`@Column('int', { default: 0 })`), `images?`
     (`@Column('simple-array', { nullable: true })` — matches this codebase's plain-column style, no new
     entity needed for a v1), `isActive` (`@Column({ default: true })`), `category` (`@ManyToOne(() =>
     Category, { onDelete: 'SET NULL', nullable: true })` + `@JoinColumn`), `createdAt`
     (`@CreateDateColumn()`), `updatedAt` (`@UpdateDateColumn()`).
   - `dto/create-product.dto.ts`, `dto/update-product.dto.ts` (`PartialType`), `dto/search-product.dto.ts`
     (`extends PaginationDto`, add `search?`, `categoryId?`, `minPrice?`, `maxPrice?`, `isActive?` —
     mirror `src/users/dto/search-user.dto.ts`'s shape), `dto/product-response.dto.ts` (mirror
     `category`'s `category-response.dto.ts` — controller methods should return the response DTO shape,
     not the raw entity, same as the existing modules).
   - `products.service.ts`: CRUD + `findAllPaginated` (copy `users.service.ts`'s `createQueryBuilder` +
     `SORTABLE_COLUMNS` whitelist + `ILike` pattern; join `category` for filtering/eager response).
   - `products.controller.ts`: `@Controller('products')`, `@ApiTags('products')`; `GET /` and
     `GET /:id` public (no guard, matching `category`'s current openness); `POST`, `PUT /:id`,
     `DELETE /:id` behind `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(UserRole.ADMIN)`.
   - `products.module.ts`: `TypeOrmModule.forFeature([Product])`, export `ProductsService` (needed by
     Cart/Orders modules later).
3. Register `ProductsModule` in `src/app.module.ts`'s `imports`.
4. Run `yarn migration:generate src/migrations/AddProductAndCategoryLink` (verify the name flag matches
   whatever `package.json`'s `migration:generate` script actually expects — check the script string first).

**Verification checklist**

- `yarn start:dev` boots without TypeORM relation errors; `swagger.json` regenerates with `products` paths.
- `GET /products` (no token) returns a `PaginatedResponseDto` envelope, `GET /products/:id` 404s cleanly
  for a missing id (mirror `category.service.ts`'s `NotFoundException` pattern).
- `POST /products` without a bearer token → 401; with a non-admin user's token → 403; with an admin
  token → 201 and a real Postgres row (check via psql or the generated migration's `up()` SQL).
- Deleting a `Category` that has products does **not** cascade-delete the products (`onDelete: 'SET NULL'`
  confirmed by inspecting the row after delete).

---

## Phase 2 — Cart module ✅ DONE (2026-08-20)

**What to implement**

1. `src/cart/entities/cart.entity.ts`: `id`, `user` (`@OneToOne(() => User, { onDelete: 'CASCADE' })` +
   `@JoinColumn`), `items` (`@OneToMany(() => CartItem, (i) => i.cart, { cascade: true })`), `createdAt`,
   `updatedAt`. One cart per user — enforce with a unique constraint on the `user` FK column
   (`@Column({ unique: true })` on the join column, or `@OneToOne` alone already implies uniqueness in
   TypeORM when `@JoinColumn` is on this side — confirm against installed TypeORM version per Phase 0's
   anti-pattern note).
2. `src/cart/entities/cart-item.entity.ts`: `id`, `cart` (`@ManyToOne(() => Cart, (c) => c.items, {
   onDelete: 'CASCADE' })`), `product` (`@ManyToOne(() => Product, { onDelete: 'CASCADE' })`), `quantity`
   (`@Column('int')`, `@Check('"quantity" > 0')` or validate in DTO), no stored `unitPrice` — always read
   current `product.price` at checkout time (cart is a live basket, not a price-locked snapshot; that
   locking happens in Orders, see Phase 3).
3. `dto/add-cart-item.dto.ts` (`productId: string` + `@IsInt() @Min(1) quantity: number`),
   `dto/update-cart-item.dto.ts` (`@IsInt() @Min(1) quantity: number`), `dto/cart-response.dto.ts` —
   every request body needs a validated DTO to satisfy the global `forbidNonWhitelisted` pipe.
4. `cart.service.ts`: `getOrCreateForUser(userId)`, `addItem(userId, productId, quantity)` (validate
   `product.stock >= quantity`, throw `BadRequestException` otherwise; if the product is already in the
   cart, increment `quantity` instead of duplicating a row), `updateItemQuantity(userId, itemId, quantity)`,
   `removeItem(userId, itemId)`, `clear(userId)`.
5. `cart.controller.ts`: `@Controller('cart')`, `@UseGuards(JwtAuthGuard)` at controller level (no
   `RolesGuard`/`@Roles` needed — cart is always "my own cart", scoped via `@CurrentUser()`, no admin
   concept applies). Routes: `GET /cart` (get-or-create + return), `POST /cart/items`, `PATCH
   /cart/items/:id`, `DELETE /cart/items/:id`, `DELETE /cart` (clear).
6. `cart.module.ts`: import `ProductsModule` (needs `ProductsService` for stock checks), export
   `CartService` (Orders will need it to convert a cart into an order and then clear it).
7. Register in `app.module.ts`. Generate migration `AddCart`.

**Verification checklist**

- Adding an item with `quantity` greater than `product.stock` → 400, no row written.
- Adding the same product twice increments quantity rather than creating two `CartItem` rows.
- `GET /cart` for a brand-new user auto-creates an empty cart rather than 404ing.
- Deleting a `Product` cascades to remove any `CartItem` referencing it (no orphaned FK).

---

## Phase 3 — Orders module ✅ DONE (2026-08-20)

**What to implement**

1. `src/orders/entities/order.entity.ts`: declare `OrderStatus` enum at top of file:
   ```ts
   export enum OrderStatus {
     PENDING = 'pending',       // created, waiting for payment
     PAID = 'paid',
     PROCESSING = 'processing', // being fulfilled
     SHIPPED = 'shipped',
     DELIVERED = 'delivered',
     CANCELLED = 'cancelled',
     EXPIRED = 'expired',       // unpaid past ttl, auto-cancelled by cron
   }
   ```
   Columns: `id`, `user` (`@ManyToOne(() => User)`), `items` (`@OneToMany(() => OrderItem, (i) =>
   i.order, { cascade: true })`), `status` (`@Column({ type: 'enum', enum: OrderStatus, default:
   OrderStatus.PENDING })`), `totalAmount` (`@Column('decimal', { precision: 10, scale: 2 })`), `currency`
   (`@Column({ default: 'GEL' })`), `shippingAddress` (plain string column for v1 — a structured Address
   embed can come later), `createdAt`, `updatedAt`, `expiresAt` (`@Column({ type: 'timestamptz',
   nullable: true })` — set on creation to `now() + ttlMinutes`, read by the cron job in Phase 5).
2. `src/orders/entities/order-item.entity.ts`: `id`, `order` (`@ManyToOne`), `product` (`@ManyToOne(() =>
   Product, { onDelete: 'SET NULL', nullable: true })` — **keep the FK nullable** so deleting a product
   later doesn't break historical orders), `productName` + `unitPrice` (`@Column('decimal', ...)`) —
   **snapshot these at order-creation time**, don't join-read `product.name`/`product.price` live, so a
   later price change doesn't rewrite history — `quantity`.
3. `dto/create-order.dto.ts` (`shippingAddress: string`, `@IsString()`), `dto/update-order-status.dto.ts`
   (`status: OrderStatus`, `@IsEnum(OrderStatus)`), `dto/search-order.dto.ts` (`extends PaginationDto`,
   add `status?`) — same "every field needs a validator" reasoning as Phase 2.
4. `orders.service.ts`:
   - `createFromCart(userId, shippingAddress)`: load the user's cart (via `CartService`), re-validate
     stock for every item (race condition guard — stock may have changed since it was added to cart),
     compute `totalAmount` from live `product.price` at this instant, snapshot into `OrderItem` rows,
     **decrement `product.stock`** for each item inside a DB transaction (use `dataSource.transaction(...)`
     — check the installed TypeORM version's transaction API before assuming v0.3 syntax), set
     `expiresAt`, then call `CartService.clear(userId)`. Throw if the cart is empty. **Lock the product
     rows for the duration of the transaction** (`.setLock('pessimistic_write')` on the query builder, or
     the installed version's equivalent — verify the actual API) so two concurrent checkouts for the same
     product can't both pass the stock check before either decrements it; re-validating stock alone isn't
     enough without a row lock.
   - `findAllForUser(userId, pagination)`, `findOneForUser(userId, orderId)` (403/404 if the order isn't
     the requesting user's, unless the requester is admin).
   - `findAllPaginated(...)` admin-only, mirroring `users.service.ts`'s pattern, filterable by `status`.
   - `updateStatus(orderId, status)` admin-only (or called internally by the Payments module on a BOG
     callback — see Phase 4). If the new status is `CANCELLED` and the order isn't already
     `CANCELLED`/`EXPIRED`, **restock** the same way `expireStaleOrders()` does — otherwise an
     admin-cancelled order silently leaks the reserved stock forever.
   - `expireStaleOrders()`: find `PENDING` orders where `expiresAt < now()`, set `EXPIRED`, **restock**
     (`product.stock += item.quantity` for each item) — called by the cron job in Phase 5.
5. `orders.controller.ts`: `@UseGuards(JwtAuthGuard, RolesGuard)`; `POST /orders` (any authenticated user,
   no `@Roles`, creates from own cart), `GET /orders` (own orders, paginated, no `@Roles`), `GET
   /orders/:id` (own or admin), `GET /orders/admin/all` or a `?all=true` admin flag + `@Roles(UserRole.ADMIN)`
   for the full paginated list, `PATCH /orders/:id/status` admin-only.
6. `orders.module.ts`: import `CartModule`, `ProductsModule`; export `OrdersService` (Payments needs it).
7. Register in `app.module.ts`. Generate migration `AddOrders`.

**Verification checklist**

- Creating an order from a cart with insufficient stock (someone else bought it first) → 400, no order
  row, no stock decrement (transaction rolled back).
- Successful order creation: cart is empty afterward, `product.stock` decremented by exactly the ordered
  quantities, `OrderItem.unitPrice`/`productName` match what the product had *at that moment*.
- A non-owner requesting `GET /orders/:id` for someone else's order → 403/404 (pick one and match
  `users.controller.ts`'s existing `assertSelfOrAdmin` pattern), unless they're admin.
- `expireStaleOrders()` (call it directly in a test, before wiring the cron) restocks correctly and never
  touches non-`PENDING` orders.
- Fire two `POST /orders` requests concurrently for the last unit of a product's stock (script two parallel
  requests, don't just reason about it) — exactly one succeeds, the other 400s; stock never goes negative.
- Admin `PATCH /orders/:id/status` → `CANCELLED` on a `PENDING` order restocks the ordered quantities.

---

## Phase 4 — Payments module (BOG, swappable provider interface) ✅ DONE (2026-08-20)

**What to implement**

1. `src/payments/entities/payment.entity.ts`: enums at top:
   ```ts
   export enum PaymentProvider { BOG = 'bog' }
   export enum PaymentStatus {
     CREATED = 'created', PROCESSING = 'processing', COMPLETED = 'completed',
     REJECTED = 'rejected', REFUNDED = 'refunded', PARTIAL_COMPLETED = 'partial_completed',
   }
   ```
   (Values chosen to match BOG's `order_status.key` vocabulary from Phase 0 — normalize 1:1 for now, add
   a translation layer only once a second provider needs a different vocabulary.)
   Columns: `id`, `order` (`@OneToOne(() => Order)` + `@JoinColumn`), `provider` (`@Column({ type:
   'enum', enum: PaymentProvider, default: PaymentProvider.BOG })`), `providerOrderId` (BOG's `id`),
   `status` (`@Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.CREATED })`),
   `rawCallbackPayload` (`@Column('jsonb', { nullable: true })` — keep the last callback body for audit/
   debugging), `createdAt`, `updatedAt`.
2. Provider abstraction — `src/payments/providers/payment-provider.interface.ts`:
   ```ts
   export interface PaymentProviderClient {
     createPayment(order: Order): Promise<{ externalId: string; redirectUrl: string }>;
     verifyCallback(rawBody: Buffer, headers: Record<string, string>): boolean;
     parseCallback(rawBody: Buffer): { externalId: string; status: PaymentStatus };
     getStatus(externalId: string): Promise<PaymentStatus>;
   }
   ```
   This is what makes TBC addable later without touching `PaymentsService`/`OrdersService` — a future
   `TbcPaymentProvider` just implements the same interface.
3. `src/payments/providers/bog-payment.provider.ts` implementing the interface above, using
   `HttpService`/`axios` (add `@nestjs/axios` if not already a dependency — check `package.json` first,
   it currently isn't listed) per the confirmed BOG facts in Phase 0:
   - Token caching: fetch+cache the OAuth2 token, refetch when `expires_in` elapses (a simple in-memory
     `{ token, expiresAt }` field is enough for v1, no need for Redis yet).
   - `createPayment`: `POST /payments/v1/ecommerce/orders` with `callback_url` pointed at this backend's
     public `/payments/callback/bog` route (from `FRONTEND_URL`/a new `BACKEND_URL` env var — check
     which one is actually reachable from BOG's servers, `localhost` will NOT work, needs a public URL or
     tunnel in dev), `redirect_urls.success`/`fail` pointed at `FRONTEND_URL` pages.
   - `verifyCallback`: SHA256withRSA signature check against BOG's published public key (store the key as
     an env var or a checked-in `.pem` file — **never commit the key inline in code**), verified against
     the **raw** request body bytes (requires a raw-body-preserving route — see controller note below).
   - `parseCallback`: map `order_status.key` → local `PaymentStatus`.
   - `getStatus`: `GET /payments/v1/receipt/{order_id}` polling fallback.
4. `payments.service.ts`: `initiate(orderId, userId)` (assert order ownership + `PENDING` status, call
   provider `createPayment`, persist a `Payment` row, return `redirectUrl` to the controller),
   `handleCallback(rawBody, headers)` (verify signature → reject with 401 if invalid; parse status →
   update `Payment.status` + `Payment.rawCallbackPayload`; if `COMPLETED`, call
   `OrdersService.updateStatus(orderId, OrderStatus.PAID)`; if `REJECTED`, leave the order `PENDING` so
   the user can retry, or transition to a dedicated failed state if the order flow needs that distinction).
   **Make this idempotent** — BOG may redeliver the same callback more than once (network retries on their
   side are normal for webhooks); if the stored `Payment.status` is already `COMPLETED`, short-circuit
   before calling `OrdersService.updateStatus` again so a duplicate delivery can't double-process or throw
   on an already-transitioned order.
5. `payments.controller.ts`: `@Controller('payments')`; `POST /payments/:orderId/initiate` behind
   `@UseGuards(JwtAuthGuard)`, returns `{ redirectUrl }` for the frontend to navigate the browser to;
   `POST /payments/callback/bog` **must not** have `JwtAuthGuard` (BOG isn't a logged-in user) — instead
   protect it purely via signature verification inside the handler, and register it with Nest's raw-body
   option (`rawBody: true` in `NestFactory.create` bootstrap options, or a dedicated raw-body middleware
   scoped to this one route) so `verifyCallback` gets the exact bytes BOG signed, not a re-serialized JSON
   object.
6. `payments.module.ts`: import `OrdersModule`; register `BogPaymentProvider` as a provider (token-injected
   so `PaymentsService` depends on the `PaymentProviderClient` interface, not the concrete class directly —
   this is the actual mechanism that makes swapping providers later a config change, not a rewrite).
7. **Out of scope for v1** (note explicitly so it isn't silently assumed done): triggering a refund via
   BOG's API. `PaymentStatus.REFUNDED` only reflects a refund BOG's dashboard/back-office initiated and
   reported back through the callback — add a `PaymentsService.refund()` calling a BOG refund endpoint in
   a later phase if in-app refunds are needed.
8. New env vars (add to `.env` and document in README/CLAUDE.md if one exists for env vars):
   `BOG_CLIENT_ID`, `BOG_CLIENT_SECRET`, `BOG_CALLBACK_URL`, `BOG_PUBLIC_KEY` (or a path to a `.pem` file),
   `BOG_BASE_URL` (default `https://api.bog.ge`, overridable for sandbox once Phase 0's sandbox-URL gap is
   resolved).
8. Register `PaymentsModule` in `app.module.ts`. Generate migration `AddPayments`.

**Verification checklist**

- `POST /payments/:orderId/initiate` on someone else's order → 403; on an already-`PAID` order → 400
  (don't double-charge).
- A forged callback (wrong/missing `Callback-Signature`) → 401, `Payment`/`Order` status untouched.
- A genuine sandbox callback (use BOG's documented sandbox test cards from Phase 0 once the sandbox base
  URL is confirmed) with `order_status.key: "completed"` → `Payment.status = COMPLETED`,
  `Order.status = PAID`, `rawCallbackPayload` stored.
- Token caching actually avoids refetching on every request (add a temporary log line, call `initiate`
  twice quickly, confirm only one token fetch).

---

## Phase 5 — Cron: expire unpaid orders ✅ DONE (2026-08-20)

**What to implement**

`ScheduleModule.forRoot()` is already registered in `app.module.ts` with no jobs yet — this is the first
one. Add to `orders.service.ts` (or a small dedicated `orders-cron.service.ts` if the file is getting
large):
```ts
@Cron(CronExpression.EVERY_MINUTE)
async handleExpiredOrders() {
  await this.expireStaleOrders(); // from Phase 3
}
```
Import `ScheduleModule` is already global via `AppModule`; just import `@nestjs/schedule`'s `Cron`/
`CronExpression` in the orders service file — no new module wiring needed.

**Verification checklist**

- Create an order with a short `ttl` (temporarily lower the default for a manual test), wait past
  `expiresAt`, confirm the cron flips it to `EXPIRED` and restocks within a minute without manual
  intervention.
- Confirm the cron never touches `PAID`/`SHIPPED`/etc. orders (query filters strictly on
  `status = PENDING AND expiresAt < now()`).

---

## Final Phase — Verification pass

1. `yarn lint` and `yarn build` clean.
2. `yarn start` (production-like: set `NODE_ENV=production` locally against a scratch DB) — confirm
   `synchronize: false` + `migrationsRun: true` actually applies all migrations generated in Phases 1–4
   cleanly on an empty database (this is the real test that migrations weren't skipped/malformed).
3. Manually walk the full happy path with the running app + swagger UI (`/api` outside production, or
   Postman against prod-mode): register → browse products → add to cart → create order → initiate BOG
   sandbox payment → simulate/receive callback → confirm order flips to `PAID`.
4. Grep for anti-patterns: no `@Roles` on customer-facing read endpoints (Phase 0 anti-pattern #4), no
   hardcoded BOG public key/secret in source (must come from env), no float columns for money
   (`grep -n "float" src/products src/orders src/payments` should be empty).
5. Re-read this plan's Phase 0 "gap" notes (BOG sandbox base URL, exact token TTL) — confirm each was
   resolved during implementation rather than silently left as an assumption.
