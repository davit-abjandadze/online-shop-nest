# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

NestJS **online shop** backend, originally copied from a referendum/polling-platform project (it still
shares that project's git history). The referendum domain is gone; the shop domain is built: catalog
(`products`, `category` tree with filterable `attribute`s, `colors`, `sizes`/product variants, `companies`,
`branches`), storefront content (`hero-slides`, `product-sliders`, `notifications`, `favorites`), commerce
(`cart`, `orders`, `payments`, `addresses`), `stats` (admin dashboard), plus `auth`, `users`, `otp` and
`common/`. Postgres via TypeORM. Georgian-language comments are the norm throughout `src/` — match that style
in new code/comments unless told otherwise.

Payments run against `MockPaymentProvider` until the company is legally registered with BOG (Bank of
Georgia); `BogPaymentProvider` is implemented and selected with `PAYMENT_PROVIDER=bog`. Refunds and callback
amount verification are deliberately deferred to that switch.

An OpenAPI document is generated to `swagger.json` on every non-production boot (see "Swagger / OpenAPI"
below) for frontend codegen.

## Commands

```bash
yarn start             # start (no watch)
yarn start:dev         # start with --watch (normal local dev)
yarn start:debug       # start with --watch --debug

yarn build             # nest build

yarn lint              # eslint --fix over src/apps/libs/test
yarn format            # prettier --write over src/ and test/

yarn test              # jest (unit, *.spec.ts under src/)
yarn test:watch        # jest --watch
yarn test:cov          # jest --coverage
npx jest path/to/file.spec.ts        # single unit test file
npx jest -t "test name substring"    # single test by name

yarn test:e2e          # jest --config ./test/jest-e2e.json (test/*.e2e-spec.ts) — needs a DB; boots
                       # AppModule with synchronize, so point DB_DATABASE at a scratch db, not shop_db

yarn migration:run                                      # apply src/migrations (data-source.ts)
yarn typeorm migration:generate src/migrations/Name     # generate from entity diff
yarn typeorm migration:generate src/migrations/X --check  # exit 1 if entities ≠ migrations (CI uses this)
```

CI (`.github/workflows/ci.yml`, checks only — no deploy) runs build, `eslint` without `--fix`, unit tests,
and the migration chain on an empty Postgres followed by `migration:generate --check`. Lint is at 0
errors — keep it there. `yarn lint` runs `eslint --fix`; on Windows prettier/eslint may rewrite line
endings of untouched files, so stage only files with real diffs (`git diff --ignore-cr-at-eol`).

Postgres is provided via `docker-compose.yml` (postgres:16-alpine, mapped to `127.0.0.1:5434`, container
`shop_postgres`, db `shop_db`) — run `docker compose up -d` before starting the app locally if you don't
already have a Postgres instance matching `.env`'s `DB_*` vars. **Deliberately different from the original
referendum project's `nest_postgres`/`nest_db`/`5433`** — this repo was copied from that project and still
shares its git history (see below); the container name/port/db were changed so the two can run side by
side without one's `synchronize: true` boot silently altering or dropping the other's tables.

There is no separate "generate swagger" script — `swagger.json` is written automatically every time the
app boots (see below). To regenerate it, just start the app (`yarn start` or `yarn start:dev`) and let it
finish bootstrapping.

## Architecture

### Module structure
Each domain is a self-contained Nest module under `src/<domain>/` with the usual `*.module.ts` /
`*.controller.ts` / `*.service.ts` / `dto/` / `entities/` layout (see Project overview for the list).
`AppController` serves `GET /` and `GET /health` (DB ping, 503 when the DB is down). Cross-cutting pieces
live in `src/common/`: `guards/roles.guard.ts`, `decorators/roles.decorator.ts` and
`current-user.decorator.ts`, `dto/pagination.dto.ts` + `paginated-response.dto.ts` (shared pagination
envelope: `{ data: T[], meta: { total, page, limit, totalPages, hasNext, hasPrevious } }`), and
`email/email.service.ts` (nodemailer, used for password-reset emails; "from" name is currently the
placeholder `"Online Shop"` — rename once the shop has a real name). `AppModule` wires
`TypeOrmModule.forRootAsync` (reads `DB_HOST`/`DB_PORT`/`DB_USERNAME`/`DB_PASSWORD`/`DB_DATABASE` from
`ConfigModule`, `autoLoadEntities: true`, `synchronize` true outside `production`) and
`ScheduleModule.forRoot()` — `OrdersService.handleExpiredOrders` (`@Cron` every minute) expires unpaid
PENDING orders and restocks them.

**Migrations:** `src/migrations/` is the only thing that builds the production schema
(`migrationsRun: true` in `production`); dev/test use `synchronize: true` and never run them, so the chain
silently drifted from the entities once already (fixed by `1788110000000-SyncSchemaWithEntities`). Every
entity change needs a migration — generate it with `migration:generate` against a DB built by
`migration:run` (not against `shop_db`, which synchronize keeps in sync), and keep migrations idempotent
(`IF NOT EXISTS` / `pg_constraint` checks) since some DBs were built by synchronize. CI's `--check` step
catches drift. Production DB TLS verifies the server cert only when `DB_SSL_CA` is set.

**Orders/stock concurrency:** every order status change goes through
`OrdersService.transitionStatusInTransaction`, which locks the order row (`FOR UPDATE`) and re-reads
status/`stockRestored` under the lock — admin cancel, the expiry cron and the payment callback all rely on
it; don't change status with a plain `update` outside it. Lock order is order → payment everywhere
(avoid deadlocks). Checkout locks the cart row and each product row (ascending id).

### Auth
JWT-based, via `@nestjs/passport` + `@nestjs/jwt` + `passport-jwt`. `AuthService.login`/`register` verify
credentials with bcrypt and return `{ access_token, user: { id, email, firstName, lastName, role, gender,
age } }` — this exact shape is what the frontend's NextAuth `CredentialsProvider` expects from
`POST /auth/login`. `AuthController` also exposes `POST /auth/google` and `POST /auth/facebook`
(`AuthService.googleLogin`/`facebookLogin`; the Facebook route is currently commented out). Google verifies
the ID token server-side (`GOOGLE_CLIENT_ID` audience + `email_verified`); if an existing account's email
was never verified, OAuth login resets its password and invalidates old sessions (account-takeover guard).
Emails are normalized to lowercase (`@NormalizeEmail()`), `findByEmail` is case-insensitive. Phone OTP
(`OtpService`, verify.ge) is bound to the number it was sent to and single-use via `consumeVerifiedOtp`;
login has a per-email failure lockout on top of the per-IP throttle (both in-memory — need Redis once there
is more than one instance). `JwtStrategy` (`src/auth/jwt.strategy.ts`)
validates the bearer token against `JWT_SECRET` (lifetime `JWT_EXPIRES_IN`, default 7d), re-reads the role
from the DB and returns `{ userId, email, role }` (`AuthenticatedUser`) as `request.user`.
`JwtAuthGuard` (`src/auth/jwt-auth.guard.ts`) enforces authentication; layer `RolesGuard` +
`@Roles(UserRole.ADMIN)` on top for admin-only endpoints (guard order matters — `JwtAuthGuard` must run
before `RolesGuard` so `request.user` is populated). Use `@CurrentUser()` to pull the decoded user off the
request instead of re-reading `request.user` manually. Other auth endpoints: `POST /auth/change-password`,
`POST /auth/forgot-password` / `POST /auth/reset-password` (JWT-based reset token with a `type: 'reset'`
claim and 1h expiry, emailed via `EmailService` using `FRONTEND_URL`).

### Database / ORM
TypeORM with `postgres` (`pg` driver). Entities under `src/<domain>/entities/`. The `typeorm` version
pinned in `package.json` (`^1.1.0`) looks alarmingly old at a glance next to `@nestjs/typeorm` `^11`, but
it's a real, current TypeORM release (TypeORM's own versioning just happens to look like that) and
`@nestjs/typeorm`'s peer range genuinely resolves it — there's no actual version-mismatch bug here; check
the installed version in `node_modules` before chasing one. Enums are modeled as Postgres `enum` columns
(e.g. `UserRole`, `Gender` on `User`) — this pattern should be followed for new shop entities too (e.g. an
`OrderStatus` enum on a future `Order`).

### Swagger / OpenAPI
`src/main.ts` builds the OpenAPI document with `@nestjs/swagger`'s `DocumentBuilder` (bearer auth enabled),
serves it at `/api` and writes it to `swagger.json` at the project root — both only outside `production`. This was originally consumed by a sibling frontend's codegen
script; that wiring is no longer known-current for this project — reconnect it once a frontend exists. CORS
in `main.ts` is currently limited to a hardcoded allowlist of localhost/LAN origins via `CORS_ORIGINS` (env)
— add new frontend origins there if needed. A global `ValidationPipe` runs with `whitelist: true`,
`forbidNonWhitelisted: true`, `transform: true`, so DTOs are the strict contract for every request
body/query. **Accepted exception:** `GET /categories/:slug/filters` and `GET /categories/:slug/products`
(`CategoryController`) take their query params as a plain `Record<string, string>`
(`CategoryFiltersQuery`), not a DTO — the filterable attribute codes (e.g. `?brand=..&amperage_min=..`)
are admin-configured data, not known at compile time, so they can't be statically declared on a class and
the global whitelist has nothing to check them against. Validation/parsing for these two routes happens by
hand inside `CategoryService` instead (`normalizeFiltersQuery`: arrays from repeated keys are joined,
lengths and prices are validated, LIKE wildcards escaped via `escapeLike`). This is intentional, not drift —
don't "fix" it by trying to force a static DTO here. Catalog controllers are `@SkipThrottle()` on purpose
(shoppers behind NAT share one IP) — protect them with input caps instead. `helmet` sets security headers
(CSP off, `crossOriginResourcePolicy: cross-origin` so `/uploads/notifications` images load from the frontend).

### Request/response conventions
Entities and DTOs use **camelCase** properties throughout (`firstName`, `createdAt`, `categoryId`, etc.) —
responses are plain camelCase JSON, not snake_case or PascalCase, and TypeORM columns are not renamed by a
naming strategy. List endpoints that support pagination take `page`/`limit`/`sortBy`/`order` query params
(`PaginationDto`) and return the `PaginatedResponseDto` envelope described above. The app listens on port
`5000`.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
