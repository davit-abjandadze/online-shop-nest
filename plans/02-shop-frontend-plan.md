# Plan 02 — Frontend: Shop UI on top of `../online-shop-next`

Status: proposed, not yet executed.
Scope: convert the sibling Next.js repo `../online-shop-next` (currently still a referendum/polling
frontend, same as the backend was before its shop conversion — see its `CLAUDE.md`) into the online-shop
frontend that consumes the backend built in `01-shop-domain-plan.md`. This plan assumes Phases 1–4 of that
backend plan are done (or done far enough that `swagger.json` already reflects `products`/`cart`/`orders`/
`payments`), since the frontend's API client is generated straight from that file.

Each phase is self-contained enough to run in a fresh chat context: it restates the relevant conventions,
cites exact files to mirror/replace, and ends with a manual verification checklist (this repo has no
established per-page test convention beyond the odd colocated `*.test.tsx`, mirrored where it already
exists — don't invent a new testing pattern wholesale).

---

## Phase 0 — Documentation discovery (findings, already gathered)

### What exists today in `online-shop-next` (referendum domain, to be repurposed/removed)

- **API client is generated, not hand-written** — `API_Client/client/` regenerates from
  `../online-shop-nest/swagger.json` via `yarn generate:api` (`scripts/generate-api.js`); never hand-edit
  it. `API_Client/index.ts` is the hand-written layer wrapping the generated `*Api` classes into
  `XxxAPI(acceptLanguage, accessToken)` factories (`AuthAPI`, `QuestionAPI`, `AnswerAPI`, `UserAnswerAPI`,
  `CategoriesAPI`, `FavoritesAPI`, `UserAPI`, `StatsAPI`) — each builds one axios instance with
  auth/timeout/size-limit/error interceptors. Once the backend swagger regenerates with the shop schema,
  `QuestionsApi`/`AnswerApi`/`UserAnswerApi`/`FavoritesApi`/`StatsApi` disappear and `ProductsApi`/`CartApi`/
  `OrdersApi`/`PaymentsApi` appear — `API_Client/index.ts` needs matching factories added/removed by hand
  (`generate:api` only regenerates `client/`, not this hand-written layer).
- **Auth** — `pages/api/auth/[...nextauth].ts`, `CredentialsProvider` posting to backend `/auth/login`
  plus Google/Facebook OAuth posting to `/auth/google`/`/auth/facebook`. JWT session strategy threads
  `access_token`/`role`/`id` onto `session.accessToken`/`session.user.role`/`session.user.id`. This layer is
  domain-agnostic (`UserRole` is already `admin`/`user` on the backend, unchanged by the shop conversion) —
  **keep as-is**, no changes needed for the shop domain.
- **Role gating** — `hooks/useAdminGuard.ts` (`isAdmin`, `isDenied`, `isLoading`) centralizes the admin
  check; reuse it for the admin product/order dashboard rather than re-deriving role checks per page.
- **i18n** — `next-translate` + `next-translate-routes`, locales `ka`/`en`/`ru` under `locales/{en,ka,ru}`,
  `middleware.ts` redirects `default` → `ka`. Domain-agnostic, keep as-is; only the translation *content*
  needs new keys for shop pages (see per-phase notes below).
- **Component layout convention** — `components/pages/<feature>/` (one folder per page, typically
  `index.tsx` + `style.ts` + optionally `schemas.ts` for yup/zod + colocated `*.test.tsx`),
  `components/shared/` (cross-page building blocks), `components/ui/` (atomic design-system pieces).
  Follow this exactly for every new shop page/feature.
- **Referendum-specific pages to remove once shop pages replace them**: `components/pages/askQuestion/`,
  `components/pages/questionDetail/`, and the `dashboard`/`home` pages' referendum-specific content (they
  likely need a full content swap, not deletion — `dashboard` is probably the shell that becomes the shop
  home/catalog page; confirm actual content before deciding delete-vs-repurpose, don't delete blind).
  `components/shared/QuestionCard/` → repurpose into a `ProductCard/` (or add alongside if the shapes are
  too different to share cleanly — decide once building Phase 1, don't force a premature abstraction).
- **`real-estate-application/` page** — unrelated leftover (like the backend's old `tasks` module was);
  confirm with the user whether it's still wanted before touching/removing it — out of scope for this plan
  either way, don't delete it as a side effect of shop work.
- **Path alias** `@/*` → repo root (`@/constants`, `@/API_Client`, `@/components/ui/Button`, etc.) — use it
  for all new imports, matching existing code.
- **Environments** — `Dev`/`Test`/`Preprod`/`Production` via `ENVIRONMENT`, exposed as `NEXT_PUBLIC_ENV`;
  `constants.ts` derives `API_URL`/`AUTH_URL`/`BASEPATH`/`CDN_URL` from `NEXT_PUBLIC_*` env vars — no
  changes needed here for the shop domain, just confirm `API_URL` still points at the same backend (it does,
  same repo/port, only the routes served change).

### Anti-patterns to avoid

- Don't hand-edit `API_Client/client/` — always regenerate via `yarn generate:api` against a running/built
  backend, then hand-adjust only `API_Client/index.ts`'s wrapper factories.
- Don't invent a new state-management library for cart/checkout — this codebase has no Redux/Zustand
  dependency in `package.json`; use React Context (there's already a `context/` directory — check its
  existing pattern before adding a new one) or SWR's cache (already a dependency) for cart state, matching
  what's already idiomatic here rather than introducing a new dependency.
- Don't build a payment form yourself for BOG — Phase 0 of the backend plan already established BOG has no
  server-side SDK but the actual checkout flow is a **redirect**: `PaymentsService.initiate` returns a
  `redirectUrl` (`https://payment.bog.ge/?order_id=...`), so the frontend's job is just to `POST
  /payments/:orderId/initiate` and `window.location.href = redirectUrl` (or `router.push` for an external
  URL) — then handle the `success`/`fail` redirect-back pages. Don't try to embed BOG's frontend widget
  package (`@bankofgeorgia/bog-payments-web-sdk`) unless a later iteration specifically wants an embedded
  flow instead of full-page redirect.
- Don't gate public catalog browsing behind NextAuth session checks — mirror the backend's anti-pattern
  guidance (Phase 0 of the backend plan): product listing/detail pages are public, only cart/checkout/
  order-history/admin pages require a session.
- Don't reintroduce a `matcher` export on `middleware.ts` — documented as breaking API auth callbacks
  (next-translate-routes + Next.js matcher bug). Leave that file's structure alone unless the shop work
  specifically requires touching it (it shouldn't).

---

## Phase 1 — API client regeneration + catalog browsing (products, categories)

**What to implement**

1. Run the backend (`yarn start:dev` in `online-shop-nest`, or at least a build) far enough that
   `swagger.json` includes `products`/`category` paths from backend Phase 1, then `yarn generate:api` in
   `online-shop-next`. Confirm `API_Client/client/` gained `ProductsApi` and lost `QuestionsApi`/
   `AnswerApi`/`UserAnswerApi`/`FavoritesApi`/`StatsApi` (only if the backend plan's later phases are also
   done — otherwise those disappear incrementally per phase).
2. `API_Client/index.ts`: add `ProductsAPI(acceptLanguage, accessToken)` and `CategoriesAPI(...)` factories
   (rename backend's `CategoriesApi` if the generated class name changed — check the actual generated
   client), following the exact `createAxiosInstance` wrapping pattern already used for `AuthAPI`/etc.
   Remove the now-dead `QuestionAPI`/`AnswerAPI`/`UserAnswerAPI`/`FavoritesAPI`/`StatsAPI` factories once
   their backend modules are actually gone (don't remove speculatively before confirming via the
   regenerated client — a factory referencing a deleted class is a build break, not a graceful no-op).
3. New `components/pages/catalog/` (replaces referendum `dashboard`'s question-feed content): `index.tsx`
   fetching paginated products via `ProductsAPI`, rendering a grid; `style.ts`; reuse `components/shared/
   Pagination/` (already domain-agnostic) for the `PaginatedResponseDto` envelope's `meta`.
4. New `components/pages/productDetail/` (parallels the old `questionDetail/`'s file shape): shows a single
   product (`GET /products/:id`), price, stock, an "add to cart" action (wired to Phase 2's cart context).
5. New `components/shared/ProductCard/` (successor to `QuestionCard/`) — decide during implementation
   whether `QuestionCard` shares enough shape to repurpose in place or should be a fresh component; if
   repurposed, rename the directory and update every import site.
6. New `components/pages/adminProducts/` (mirrors `useAdminGuard`-gated dashboard patterns elsewhere in the
   app) with a simple table + create/edit form for admin CRUD (`POST`/`PUT`/`DELETE /products/:id`), gated
   by `useAdminGuard`'s `isAdmin`/`isDenied`.
7. Category filter: a simple dropdown/select (reuse `components/ui/customComponentSelect/` or
   `Dropdown/`, whichever this codebase already uses for similar filters — check current `dashboard` filter
   UI before picking) driving the catalog page's `categoryId` query param.
8. Add/replace translation keys under `locales/{en,ka,ru}` for catalog/product-detail strings; leave
   referendum-only keys (`question.*`, `answer.*`, etc.) in place until their pages are actually deleted, to
   avoid a half-broken intermediate state.

**Verification checklist**

- `yarn generate:api` completes without errors against the regenerated `swagger.json`; `yarn build` (or
  `yarn dev`) doesn't fail on a missing/renamed API class.
- `/[locale]/catalog` (or wherever routed) renders products from a real backend call, paginates correctly,
  and the category filter narrows results.
- Product detail page 404s gracefully (not a Next.js crash page) for an unknown id, matching how the
  backend 404s.
- Admin product create/edit/delete works end-to-end for a user with `role: admin`; a non-admin session
  sees `isDenied` from `useAdminGuard` instead of the form.
- No import anywhere in the app still references a deleted `QuestionsApi`/`AnswerApi`/etc. factory
  (`grep -rn "QuestionAPI\|AnswerAPI\|UserAnswerAPI\|FavoritesAPI\|StatsAPI" components pages` empty, once
  those backend modules are confirmed gone).

---

## Phase 2 — Cart

**What to implement**

1. Cart state: check `context/`'s existing pattern first (what's already there, if anything, for
   cross-page shared state) and follow it — likely a `CartContext` exposing `cart`, `addItem`,
   `updateItemQuantity`, `removeItem`, `clear`, backed by calls to the new `CartAPI` (`GET /cart`,
   `POST /cart/items`, `PATCH /cart/items/:id`, `DELETE /cart/items/:id`, `DELETE /cart`) — the cart itself
   is server-side per Phase 2 of the backend plan (one cart per authenticated user), so this context is a
   thin client cache over those calls, not the source of truth.
2. `API_Client/index.ts`: add `CartAPI(acceptLanguage, accessToken)` factory.
3. New `components/shared/CartIcon/` (or similar, in the Header) — a small badge showing item count, reused
   in `components/shared/Header/`.
4. New `components/pages/cart/`: line items (product name/image/price/quantity/subtotal), quantity
   steppers calling `updateItemQuantity`, remove buttons, a running total, and a "checkout" CTA that routes
   to Phase 3's order-creation flow. Needs an authenticated session (backend's `CartController` is
   `JwtAuthGuard`-only, no public cart) — redirect unauthenticated visitors through the existing
   `AuthModal`/login flow rather than building a new one.
5. "Add to cart" action wired into `productDetail`'s and `ProductCard`'s UI from Phase 1, calling the new
   context's `addItem`; surface the backend's 400 (`stock < quantity`) as an inline error via the existing
   `components/ui/Alert/`, not a raw thrown exception.

**Verification checklist**

- Adding a product to the cart from both the catalog grid and the detail page updates the Header badge
  count without a full page reload.
- Attempting to add more than available stock shows the backend's 400 as a user-facing message, not a
  console error / blank crash.
- Cart persists across a page refresh (it's server-backed, so a re-fetch on mount is enough — confirm the
  context actually re-fetches rather than only relying on stale client state).
- Unauthenticated visit to `/cart` prompts login rather than 401-crashing.

---

## Phase 3 — Checkout / Orders

**What to implement**

1. `API_Client/index.ts`: add `OrdersAPI(acceptLanguage, accessToken)` factory.
2. New `components/pages/checkout/`: a shipping-address form (`schemas.ts` with yup/zod validation, matching
   this codebase's existing form-validation convention — check an existing page's `schemas.ts`, e.g. under
   `register/` or `profile/`, before picking yup vs zod so both aren't used inconsistently), submitting to
   `POST /orders` (`createFromCart`). On success, route straight into Phase 4's payment-initiation call
   (checkout's "place order" and "pay now" are effectively one user action, per the backend's
   `createFromCart` → immediately-payable `PENDING` order design) — don't leave a dead intermediate page
   where an order exists but nothing prompts payment.
3. New `components/pages/orders/` (order history list, paginated via `GET /orders`) and
   `components/pages/orderDetail/` (`GET /orders/:id`) showing status, items, total, and — for a `PENDING`
   order — a "pay now" button re-entering the Phase 4 flow (covers the case where a user abandoned payment
   and returns later).
4. New `components/pages/adminOrders/` (admin-only via `useAdminGuard`): paginated list of all orders
   (`?all=true` or whatever the backend Phase 3 admin route ends up being — confirm exact route once
   backend Phase 3 lands), filter by status, and a status-update action (`PATCH /orders/:id/status`).
5. Surface `OrderStatus` values (`pending`/`paid`/`processing`/`shipped`/`delivered`/`cancelled`/`expired`)
   as translated, styled badges (reuse `components/ui/HighlightedIcon/` or similar existing status-badge
   pattern if one exists; otherwise a small new `OrderStatusBadge` under `components/shared/`).

**Verification checklist**

- Checking out with an empty cart is prevented client-side (button disabled/hidden) *and* handled
  gracefully if the backend still rejects it (400 shown, not a crash) — don't rely on the client-side guard
  alone.
- A successful checkout empties the cart (Header badge returns to 0) and lands the user on the payment
  flow, not a dead-end confirmation page with no next action.
- Order history shows correct status badges and paginates; a non-owner can't reach another user's order
  detail via a guessed URL (mirror whatever 403/404 the backend actually returns — confirm it's handled,
  not left as an unstyled error page).
- Admin order list + status update works for an admin session; hidden/blocked for a non-admin session.

---

## Phase 4 — Payments (BOG redirect flow)

**What to implement**

1. `API_Client/index.ts`: add `PaymentsAPI(acceptLanguage, accessToken)` factory.
2. Checkout success (Phase 3) or an order-detail "pay now" button calls
   `POST /payments/:orderId/initiate`, receives `{ redirectUrl }`, and full-page-redirects
   (`window.location.href = redirectUrl`) to BOG's hosted payment page — this is an external redirect, not
   client-side routing, so use a real navigation, not `next/router`'s `push`.
3. New pages for BOG's `redirect_urls.success`/`fail` (whatever `FRONTEND_URL` paths the backend Phase 4
   env vars are configured to point at — coordinate the exact path with backend Phase 4's
   `BOG_CALLBACK_URL`/redirect config before hardcoding one here): a success page that re-fetches the order
   (`GET /orders/:id`) to confirm it actually flipped to `PAID` (the redirect itself doesn't guarantee the
   backend's async callback has landed yet — poll a few times with backoff or show a "confirming payment…"
   state rather than trusting the redirect alone) and a fail page offering "try again" (re-initiates
   payment) or "back to cart".
4. No frontend work needed for the actual BOG callback (`POST /payments/callback/bog`) — that's
   server-to-server between BOG and the NestJS backend, invisible to this repo.

**Verification checklist**

- "Pay now" navigates the browser to BOG's real hosted page (`https://payment.bog.ge/?order_id=...`) for a
  sandbox order — confirm with a sandbox test card from the backend plan's Phase 0 facts.
- The success page doesn't declare success prematurely — it actually reflects the order's true status
  (test by deliberately using a declined sandbox card and confirming the "success" page doesn't falsely
  show `PAID`).
- Fail/decline path offers a working retry that re-initiates payment for the same order (not a duplicate
  order).

---

## Final Phase — Cleanup + verification pass

1. Delete (or archive, if the user wants a reference) fully-superseded referendum pages/components once
   every replacement above is live: `components/pages/askQuestion/`, `components/pages/questionDetail/`
   (if not repurposed), old `QuestionCard/` (if not repurposed), and any now-dead translation keys —
   confirm each is actually unreferenced (`grep -rn` for the component/page name) before deleting, same
   discipline as the backend plan's migration-not-skipped final check.
2. `yarn lint` and `yarn build:prod` clean.
3. Full manual walkthrough: browse catalog → view product → add to cart → checkout → BOG sandbox payment
   → land on success page reflecting real `PAID` status → see the order in order history — the same
   end-to-end path the backend plan's Final Phase describes, now exercised through the actual UI instead of
   swagger/curl.
4. Confirm `API_Client/index.ts` has no leftover factory referencing a class the generated client no longer
   exports, and no shop page bypasses `useAdminGuard`/session checks where the backend requires them (mirror
   backend Phase 0's anti-pattern #4 — no admin-gating on customer-facing browse/cart/checkout pages, and no
   *missing* gating on admin pages, both directions matter).
