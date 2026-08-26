# გეგმა: იერარქიული კატეგორიები + დინამიური Attribute სისტემა

> სტატუსი: ფაზა 1 (Category hierarchy) დასრულებულია (2026-08-26). ფაზა 2
> (Attribute core) დასრულებულია (2026-08-26). ფაზა 3-დან გასაგრძელებელია.

## ფაზა 1 — შესრულებულია (2026-08-26) ✅

- `Category` entity გადავიდა `closure-table` ხის სტრუქტურაზე (`@Tree`/`@TreeParent`/`@TreeChildren`):
  `id` (uuid), `nameKa`, `nameEn`, `slug` (unique), `isActive`, `sortOrder`, `image`,
  `seoTitle`, `seoDescription`, `seoKeywords`, `parent`, `createdAt`/`updatedAt`.
- Migration `1787760462682-AddCategoryHierarchy` — ძველი `name`/`description` სვეტები
  წაშლილია, `category.id` integer→uuid გახდა (`product.categoryId`-იც შესაბამისად uuid-ზე
  გადავიდა), `category_closure` ცხრილი დაემატა. ძველი test/seed კატეგორიის მწკრივები
  წაშლილია (production მონაცემები არ არსებობდა).
- `CategoryService`: `findAllPaginated` (flat + `?parentId=`), `findTree`
  (`TreeRepository.findTrees()`), `findOne`, `findBySlug`, `create`/`update` (slug
  უნიკალურობა, წრიული parent-ის დაცვა `assertNotDescendant`-ით), `remove` (RESTRICT
  შვილებზე + დაცვა მიბმულ პროდუქტებზე).
- `CategoryController`: `GET /categories`, `GET /categories/tree`,
  `GET /categories/by-slug/:slug`, `GET /categories/:id` — საჯარო; `POST`/`PUT /:id`/
  `DELETE /:id` — `JwtAuthGuard` + `RolesGuard` + `@Roles(ADMIN)` (products მოდულის
  პატერნით, მანამდე საერთოდ არ ჰქონდა guard).
- `Product.categoryId`/DTO-ები (`CreateProductDto`, `SearchProductDto`) გადავიდა
  `number`-იდან `string` (uuid, `@IsUUID()`) ტიპზე.
- გატესტილია რეალურ dev DB-ზე (docker `shop_postgres`): migration გაშვებულია,
  drift-check სუფთაა (`migration:generate` — "No changes"), app ჩატვირთვა + admin-guard,
  ხის შექმნა/`GET /tree`/`by-slug`, slug-კონფლიქტი (409), წრიული parent (400),
  შვილიანი კატეგორიის წაშლის ბლოკი (409) — ყველა curl-ით გადამოწმებულია.
- ცნობილი side-effect: `product.categoryId`-ის ტიპცვლილებამ ავტომატურად გამოააშკარავა
  და გამოასწორა წინა `AddPayments` migration-ის ჩანაწერის ნაკლულობა `migrations`
  ცხრილში (schema უკვე `synchronize`-ით არსებობდა, ჩანაწერი აკლდა) — ხელით ჩაწერილია.

## ფაზა 2 — შესრულებულია (2026-08-26)

- ახალი `src/attribute/` მოდული, `category` მოდულის იმავე პატერნით
  (entities/dto/service/controller/module).
- `Attribute` entity: `id` (uuid), `nameKa`, `nameEn`, `code` (unique slug),
  `type` (`AttributeType` enum: `select`/`multi_select`/`number`/`text`/
  `boolean`/`range`), `unit`, `isFilterable`, `isRequired`, `sortOrder`,
  `options` (`OneToMany` → `AttributeOption`, `cascade: true`), `createdAt`/
  `updatedAt`.
- `AttributeOption` entity: `id` (uuid), `attributeId` FK (`onDelete: CASCADE`),
  `valueKa`, `valueEn`, `code`, `sortOrder`, `createdAt`/`updatedAt`;
  `unique(attributeId, code)`.
- `AttributeService`: `findAllPaginated` (querybuilder, `type`/`isFilterable`
  ფილტრებით, SQL-injection-დაცული `sortBy`), `findOne` (options-ითურთ),
  `create`/`update` (code უნიკალურობა), `remove` (options კასკადურად
  წაიშლება), `addOption`/`updateOption`/`removeOption` (option-ის დამატება
  დაშვებულია მხოლოდ `select`/`multi_select` ტიპებზე, code უნიკალურია
  attribute-ის ფარგლებში).
- `AttributeController`: `GET /attributes`, `GET /attributes/:id` — საჯარო;
  `POST`/`PUT /:id`/`DELETE /:id` და
  `POST`/`PUT`/`DELETE /:id/options/:optionId` — `JwtAuthGuard` + `RolesGuard`
  + `@Roles(ADMIN)`.
- `AttributeModule` დარეგისტრირებულია `AppModule`-ში (`CategoryModule`-ის
  შემდეგ, `ProductsModule`-ის წინ).
- Migration `1787762861841-AddAttributeSystem` — `attribute_type_enum`,
  `attribute`, `attribute_option` ცხრილები + FK.
- გატესტილია dev DB-ზე: migration-ის schema ხელახლა დაგენერირებული `CREATE
  TYPE`-ის დასამატებლად (პირველი generate-ის დროს ცარიელი enum ტიპი უკვე
  არსებობდა auto-sync-იდან და გამოტოვა), drift-check სუფთაა
  (`migration:generate` — "No changes"), app ჩატვირთვა + `GET /attributes`
  რეალურ სერვერზე დამოწმებულია (200, ცარიელი გვერდიანი სია). ADMIN
  write-ების ცოცხალი curl-ტესტი არ ჩატარებულა (admin credential ხელმისაწვდომი
  არ იყო ამ სესიაში) — ლოგიკა `category`-ს იმავე, უკვე გატესტილი პატერნით
  არის დაწერილი.

## მიმდინარე მდგომარეობა (2026-08-26-ის მდგომარეობით)

- `src/category/` — **ბრტყელია**: `id`, `name`, `description` მხოლოდ. არანაირი
  parent/slug/attribute კავშირი. Controller-ს (`category.controller.ts`) საერთოდ
  არ აქვს auth/role guard — ეს თავისთავად ხარვეზია, გასწორდება ამ სამუშაოს
  ფარგლებში (`JwtAuthGuard` + `RolesGuard` + `@Roles(UserRole.ADMIN)`, products
  მოდულის პატერნის მიხედვით).
- `src/products/` — მზადაა, სრული CRUD + pagination + role guards +
  querybuilder-ზე დაფუძნებული ფილტრები (`products.service.ts`). `Product` →
  `Category` ამჟამად `ManyToOne` (`onDelete: SET NULL`), მომავალში გადადის
  many-to-many-ზე.
- Attribute სისტემა: `Attribute`/`AttributeOption` (ფაზა 2) **მზადაა**
  (`src/attribute/`). `CategoryAttribute`/`ProductAttributeValue` (ფაზა 3/4)
  — ჯერ არ არსებობს.
- `src/common/` — `PaginationDto`/`PaginatedResponseDto`, `RolesGuard`,
  `@Roles`/`@CurrentUser` decorator-ები უკვე მზადაა, გამოსაყენებელია ახალ
  მოდულებშიც.
- `src/migrations/` — 7 არსებული migration (`AddProductAndCategoryLink`,
  `AddCart`, `AddOrders`, `AddPayments`, `AddCategoryHierarchy`,
  `AddProductVideoUrl`, `AddAttributeSystem`). `synchronize` production-ში
  გამორთულია → ყოველი schema ცვლილება ახალ migration ფაილს საჭიროებს.
- `UserRole` enum-ში მხოლოდ `ADMIN`/`USER` არსებობს.

## 1. Database schema

### `category` (თვითრეფერენციული ხე)
```
id             uuid PK
nameKa         varchar
nameEn         varchar
slug           varchar unique
parentId       uuid FK -> category.id, nullable, onDelete: RESTRICT
isActive       boolean default true
sortOrder      int default 0
image          varchar nullable
seoTitle       varchar nullable
seoDescription varchar nullable
seoKeywords    varchar nullable
createdAt / updatedAt
```
ხის query-ებისთვის (children/ancestors/breadcrumb): TypeORM `@Tree('closure-table')`
— დაწყებისას გადავამოწმებთ ინსტალირებულ TypeORM ვერსიაზე მხარდაჭერას;
fallback — adjacency-list (`parentId`) + recursive CTE service მეთოდები.

### `product_category` (many-to-many join)
```
productId, categoryId   (composite PK)
```
ჩანაცვლებს ამჟამინდელ `product.categoryId` ManyToOne-ს.

### `attribute`
```
id, nameKa, nameEn, code (slug, unique)
type          enum: select | multi_select | number | text | boolean | range
unit          varchar nullable   (Ah, V, mm...)
isFilterable  boolean default true
isRequired    boolean default false
sortOrder     int
createdAt / updatedAt
```

### `attribute_option` (მხოლოდ select/multi_select ტიპისთვის)
```
id, attributeId FK, valueKa, valueEn, code (slug), sortOrder
unique(attributeId, code)
```

### `category_attribute` (Attribute Set)
```
id, categoryId FK, attributeId FK, sortOrder
isRequiredOverride  boolean nullable
unique(categoryId, attributeId)
```

### `product_attribute_value`
```
id, productId FK, attributeId FK
attributeOptionId  FK nullable   (select/multi_select-ისთვის)
valueText          varchar nullable
valueNumber        decimal nullable
valueBoolean       boolean nullable
```
multi_select-ისთვის: ერთ პროდუქტს, ერთ attribute-ზე, რამდენიმე row (თითო
option-ზე ერთი).

ინდექსები: `category(parentId)`, `category(slug)`,
`product_attribute_value(attributeId, attributeOptionId)`,
`product_attribute_value(productId)`.

## 2. API Endpoints ✅

### Category
- `GET /categories` — flat + pagination (`?parentId=`)
- `GET /categories/tree` — სრული nested tree
- `GET /categories/by-slug/:slug`
- `GET /categories/:id`
- `POST /categories` · `PATCH /categories/:id` · `DELETE /categories/:id` — **ADMIN**
- `GET /categories/:id/attributes` — attribute set (+ მშობლების, თუ inherit)
- `POST /categories/:id/attributes` / `DELETE /categories/:id/attributes/:attributeId` — **ADMIN**

### Attribute (ADMIN write, public read საჭიროებისამებრ)
- `GET /attributes` (paginated) · `GET /attributes/:id`
- `POST /attributes` · `PATCH /attributes/:id` · `DELETE /attributes/:id`
- `POST /attributes/:id/options` · `PATCH .../options/:optionId` · `DELETE .../options/:optionId`

### Product
- `GET /products/:id/attribute-values`
- `PUT /products/:id/attribute-values` — bulk set (dynamic ფორმიდან)
- `products.categoryId` → `categoryIds[]` (many-to-many)

### ფილტრაცია / ლისტინგი (მთავარი ფუნქცია)
- `GET /categories/:slug/filters` — `isFilterable=true` attribute-ები (+
  ქვეკატეგორიები), options + faceted counts, მიმდინარე query-ის გათვალისწინებით
- `GET /categories/:slug/products?brand=banner,mutlu&amperage_min=60&amperage_max=100&subcategory=msubuki&page=&limit=&sortBy=&order=`
  — filtered+paginated `PaginatedResponseDto<Product>`, `products.service.ts`-ის
  querybuilder პატერნის გაფართოებით (dynamic JOIN-ები
  `product_attribute_value`-ზე თითო აქტიურ ფილტრზე)

## 3. Frontend component structure (`online-shop-next`, ცალკე repo, ბექენდის შემდეგ)
- `FilterSidebar` — Checkbox/Range/Dropdown/TireSize ვარიანტები
- `DynamicAttributeForm` — ადმინის პროდუქტის ფორმა, კატეგორიის attribute set-ის
  მიხედვით
- `CategoryTreeAdmin` — nested drag-sort tree editor
- `useCategoryFilters` hook — URL query params ↔ filter state sync

## 4. Implementation phases

1. **Category hierarchy** — migration + entity რეფაქტორი + tree service
   (children/ancestors/circular-parent დაცვა) + role guards endpoint-ებზე
2. **Attribute core** — `Attribute` + `AttributeOption` entities/CRUD/migration
3. **Category ↔ Attribute** — `CategoryAttribute` join + admin endpoints +
   `GET /categories/:id/attributes`
4. **Product ↔ Attribute values** — `ProductAttributeValue` entity + bulk
   set/get endpoints, `product.categoryId` → many-to-many მიგრაცია
5. **Filter/facet endpoint** — dynamic querybuilder + faceted counts
6. *(ცალკე, მოგვიანებით — არ შედის საწყის სქოუპში)* Excel/CSV import,
   Elasticsearch/Meilisearch
7. Frontend (`online-shop-next`) — ცალკე ეტაპი, ბექენდის დასრულების შემდეგ

რეკომენდებული თანმიმდევრობა: 1 → 2 → 3 → 4 → 5, თითოეული ფაზა ცალკე
commit-ად/migration-ად.
