# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

NestJS backend for a referendum/polling platform. It is the API for a separate Next.js frontend (sibling
repo `../nest-referendum`), which consumes this backend through an OpenAPI-generated client built from
`swagger.json` (see "Swagger / OpenAPI" below). Postgres via TypeORM. Georgian-language comments are the
norm throughout `src/` — match that style in new code/comments unless told otherwise.

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

Postgres is provided via `docker-compose.yml` (postgres:16-alpine, mapped to host port `5433`, container
`nest_postgres`, db `nest_db`) — run `docker compose up -d` before starting the app locally if you don't
already have a Postgres instance matching `.env`'s `DB_*` vars.

There is no separate "generate swagger" script — `swagger.json` is written automatically every time the
app boots (see below). To regenerate it, just start the app (`yarn start` or `yarn start:dev`) and let it
finish bootstrapping.

## Architecture

### Module structure
Each domain is a self-contained Nest module under `src/<domain>/` with the usual `*.module.ts` /
`*.controller.ts` / `*.service.ts` / `dto/` / `entities/` layout: `auth`, `users`, `question` (with
`answer`, `user-answer` for the referendum voting flow), `category`, `favorite`, `stats`, `tasks`. Cross-
cutting pieces live in `src/common/`: `guards/roles.guard.ts`, `decorators/roles.decorator.ts` and
`current-user.decorator.ts`, `dto/pagination.dto.ts` + `paginated-response.dto.ts` (shared pagination
envelope: `{ data: T[], meta: { total, page, limit, totalPages, hasNext, hasPrevious } }`), and
`email/email.service.ts` (nodemailer, used for password-reset emails). `AppModule` wires
`TypeOrmModule.forRootAsync` (reads `DB_HOST`/`DB_PORT`/`DB_USERNAME`/`DB_PASSWORD`/`DB_DATABASE` from
`ConfigModule`, `autoLoadEntities: true`, **`synchronize: true`** — dev-only schema sync, no migrations) and
`ScheduleModule.forRoot()` for cron jobs. `QuestionService` has `@Cron` jobs (`EVERY_MINUTE`,
`EVERY_DAY_AT_MIDNIGHT`) that auto-deactivate expired questions.

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
TypeORM with `postgres` (`pg` driver). Entities under `src/<domain>/entities/`. Note the `typeorm` version
pinned in `package.json` is unusually old (`^1.1.0`) relative to `@nestjs/typeorm` `^11` — if TypeORM APIs
don't behave as the v0.3.x docs suggest, check the actually-installed version in `node_modules` before
assuming a bug. Enums are modeled as Postgres `enum` columns (e.g. `UserRole`, `Gender` on `User`;
`QuestionType`, `CreatorType`, `ApprovalStatus` on `Question`). `Question` in particular encodes the
user-submitted-question moderation workflow: `creatorType` (admin/user), `approvalStatus`
(pending/approved/rejected), `isActive`, `isPinned`, plus IP-based one-question-per-day throttling for user
submissions.

### Swagger / OpenAPI (feeds the frontend)
`src/main.ts` builds the OpenAPI document with `@nestjs/swagger`'s `DocumentBuilder` (bearer auth enabled),
serves it at `/api`, and — on every single app startup — writes it to `swagger.json` at the project root
via `writeFileSync`. The frontend's `scripts/generate-api.js` reads that exact file
(`../my-first-nest-app/swagger.json`) to regenerate its typescript-axios API client. **This means the
backend must be started at least once after any controller/DTO change before the frontend can pick up the
new API shape** — if swagger.json looks stale, run `yarn start` (or `start:dev`) here first. CORS in
`main.ts` is currently limited to a hardcoded allowlist of localhost/LAN origins — add new frontend origins
there if needed. A global `ValidationPipe` runs with `whitelist: true`, `forbidNonWhitelisted: true`,
`transform: true`, so DTOs are the strict contract for every request body/query.

### Request/response conventions
Entities and DTOs use **camelCase** properties throughout (`firstName`, `createdAt`, `categoryId`, etc.) —
responses are plain camelCase JSON, not snake_case or PascalCase, and TypeORM columns are not renamed by a
naming strategy. List endpoints that support pagination take `page`/`limit`/`sortBy`/`order` query params
(`PaginationDto`) and return the `PaginatedResponseDto` envelope described above. The app listens on port
`4000`.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
