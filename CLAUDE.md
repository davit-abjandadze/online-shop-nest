# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

NestJS backend being converted from a copied referendum/polling-platform project into an **online shop**
backend. The referendum-specific domain (`question`, `answer`, `user-answer`, `favorite`, `stats`) and the
unrelated tutorial leftover (`tasks`) have been removed; only the generic, reusable infrastructure was
kept: `auth`, `users`, `category` (currently just a bare name/description entity, no longer linked to
`question` — intended to become the product-category module), and `common/` (pagination, roles guard,
email service). Shop domain modules (products, orders, cart, payments, etc.) still need to be designed and
built from scratch. Postgres via TypeORM. Georgian-language comments are the norm throughout `src/` — match
that style in new code/comments unless told otherwise.

An OpenAPI document is still generated to `swagger.json` on every boot (see "Swagger / OpenAPI" below) in
case a frontend is wired up again later, but there is currently no known consuming frontend repo — update
this section once one exists.

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

yarn test:e2e          # jest --config ./test/jest-e2e.json (test/*.e2e-spec.ts)
```

Postgres is provided via `docker-compose.yml` (postgres:16-alpine, mapped to host port `5434`, container
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
`*.controller.ts` / `*.service.ts` / `dto/` / `entities/` layout. Currently only `auth`, `users`, and
`category` exist — everything else (products, orders, cart, etc.) is yet to be built. Cross-cutting pieces
live in `src/common/`: `guards/roles.guard.ts`, `decorators/roles.decorator.ts` and
`current-user.decorator.ts`, `dto/pagination.dto.ts` + `paginated-response.dto.ts` (shared pagination
envelope: `{ data: T[], meta: { total, page, limit, totalPages, hasNext, hasPrevious } }`), and
`email/email.service.ts` (nodemailer, used for password-reset emails; "from" name is currently the
placeholder `"Online Shop"` — rename once the shop has a real name). `AppModule` wires
`TypeOrmModule.forRootAsync` (reads `DB_HOST`/`DB_PORT`/`DB_USERNAME`/`DB_PASSWORD`/`DB_DATABASE` from
`ConfigModule`, `autoLoadEntities: true`, `synchronize` true outside `production`) and
`ScheduleModule.forRoot()`, kept registered for future cron jobs (e.g. expiring unpaid orders) — there are
no `@Cron` jobs left in the codebase right now. `src/migrations/` now holds real shop migrations (18 files,
spanning products/categories through addresses, branches, companies, and content translations) —
`migrationsRun: true` applies them automatically in `production`; `synchronize: true` still handles schema
sync in dev/test instead of running migrations there. Confirm CI/staging actually exercises
`migration:run` against a prod-like schema before merging, since local dev never runs that path.

### Auth
JWT-based, via `@nestjs/passport` + `@nestjs/jwt` + `passport-jwt`. `AuthService.login`/`register` verify
credentials with bcrypt and return `{ access_token, user: { id, email, firstName, lastName, role, gender,
age } }` — this exact shape is what the frontend's NextAuth `CredentialsProvider` expects from
`POST /auth/login`. `AuthController` also exposes `POST /auth/google` and `POST /auth/facebook`
(`AuthService.googleLogin`/`facebookLogin`), which look up or create a user by email and return the same
token shape — the frontend calls these from its OAuth `signIn` callbacks to mint a backend session, they
don't do real Google/Facebook token verification server-side. `JwtStrategy` (`src/auth/jwt.strategy.ts`)
validates the bearer token against `JWT_SECRET` and returns `{ userId, email, role }` as `request.user`.
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
serves it at `/api` outside `production`, and — on every single app startup — writes it to `swagger.json`
at the project root via `writeFileSync`. This was originally consumed by a sibling frontend's codegen
script; that wiring is no longer known-current for this project — reconnect it once a frontend exists. CORS
in `main.ts` is currently limited to a hardcoded allowlist of localhost/LAN origins via `CORS_ORIGINS` (env)
— add new frontend origins there if needed. A global `ValidationPipe` runs with `whitelist: true`,
`forbidNonWhitelisted: true`, `transform: true`, so DTOs are the strict contract for every request
body/query.

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
