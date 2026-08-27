# გეგმა: იერარქიული კატეგორიები + დინამიური Attribute სისტემა

> სტატუსი: ფაზა 1 (Category hierarchy) დასრულებულია (2026-08-26). ფაზა 2
> (Attribute core) დასრულებულია (2026-08-26). ფაზა 3 (Category ↔ Attribute)
> დასრულებულია (2026-08-26). ფაზა 4 (Product ↔ Attribute value)
> დასრულებულია (2026-08-26). ფაზა 5 (Filter/facet endpoint) დასრულებულია
> (2026-08-26). **Frontend (`online-shop-next`) დასრულებულია (2026-08-26)** —
> იხ. ქვემოთ "ფაზა 7 — Frontend". დარჩენილია მხოლოდ Excel/CSV
> import/Elasticsearch (ცალკე, საწყის scope-ს გარეთაა).

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

## ფაზა 2 — შესრულებულია (2026-08-26) ✅

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

## ფაზა 3 — შესრულებულია (2026-08-26) ✅

- ახალი `CategoryAttribute` join entity (`src/category/entities/category-attribute.entity.ts`):
  `id` (uuid), `category`/`categoryId` FK (`onDelete: CASCADE`),
  `attribute`/`attributeId` FK (`onDelete: CASCADE`), `sortOrder`,
  `isRequiredOverride` (`boolean | null` — `null` = attribute-ის საკუთარი
  `isRequired` უცვლელად გამოიყენება), `unique(category, attribute)`,
  `createdAt`/`updatedAt`.
- `CategoryService`-ს დაემატა: `findAttributesForCategory` (`TreeRepository.
  findAncestors`-ით იღებს მთელ წინაპარ ჯაჭვს + საკუთარ თავს, უერთებს ყველა
  დონის `category_attribute` მწკრივებს და `attributeId`-ზე დუბლირებისას
  საკუთარი კატეგორიის მწკრივს ანიჭებს უპირატესობას — ესე ხდება
  მემკვიდრეობა), `addAttributeToCategory` (ამოწმებს category/attribute
  არსებობას, დუბლის დაცვას), `removeAttributeFromCategory` (მხოლოდ
  პირდაპირ, ამ კატეგორიაზე დამატებული მწკრივის მოხსნა — მემკვიდრეობით
  მიღებული parent-ის მწკრივი ცალკე ვერ იშლება, საჭიროებისას parent-იდანვე
  უნდა მოიხსნას).
- `CategoryController`-ს დაემატა: `GET /categories/:id/attributes`
  (საჯარო), `POST /categories/:id/attributes` და
  `DELETE /categories/:id/attributes/:attributeId` (ორივე `JwtAuthGuard` +
  `RolesGuard` + `@Roles(ADMIN)`).
- `CategoryModule`-ს დაემატა `CategoryAttribute` + `Attribute` entity
  (`TypeOrmModule.forFeature`) — `AttributeService`/`AttributeModule`-ის
  სრული იმპორტის გარეშე, პირდაპირ `Repository<Attribute>`-ით (არსებობის
  შემოწმებისთვის), circular-dependency-ის თავიდან ასაცილებლად.
- Migration `1787762900000-AddCategoryAttribute` — `category_attribute`
  ცხრილი + FK-ები (`category`/`attribute`-ზე, `onDelete: CASCADE`) +
  `unique(categoryId, attributeId)`.
- გატესტილია dev DB-ზე: schema უკვე `synchronize`-ით შეიქმნა (dev server
  watch-რეჟიმში მუშაობდა), migration ხელით დაიწერა ცოცხალ schema-ზე
  დაყრდნობით (`\d category_attribute`) და migrations ცხრილში ხელით
  ჩაიწერა ჩანაწერი (იგივე პატერნი, რაც Phase 1-ის `AddPayments`
  ჩანაწერის ნაკლულობის გამოსასწორებლად იყო გამოყენებული) —
  `migration:generate` შემდეგ "No changes" აბრუნებს (drift-check სუფთაა).
  `yarn build` სუფთაა. რეალურ სერვერზე დამოწმებულია: `GET /categories/:id/
  attributes` ცარიელ მასივს აბრუნებს ახლადშექმნილ კატეგორიაზე (200),
  არარსებულ კატეგორიაზე 404, `POST`/`DELETE` ავტორიზაციის გარეშე 401.
  ADMIN write-ის (attribute-ის რეალური მიბმის + inheritance-ის) ცოცხალი
  curl-ტესტი არ ჩატარებულა (admin credential ხელმისაწვდომი არ იყო ამ
  სესიაში, ისევე როგორც Phase 2-ში) — ლოგიკა `category`/`attribute`-ის
  იმავე, უკვე გატესტილი პატერნით არის დაწერილი.

## ფაზა 4 — შესრულებულია (2026-08-26) ✅

- ახალი `ProductAttributeValue` entity (`src/products/entities/product-attribute-value.entity.ts`):
  `id` (uuid), `product`/`productId` FK (`onDelete: CASCADE`, `productId`
  — `number`, `Product.id`-ის ტიპის შესაბამისად), `attribute`/`attributeId`
  FK (`onDelete: CASCADE`), `attributeOption`/`attributeOptionId` FK
  (`onDelete: CASCADE`, nullable — მხოლოდ select/multi_select-ისთვის),
  `valueText`/`valueNumber`/`valueBoolean` (ტიპ-სპეციფიკური, ყველა
  nullable), `unique(productId, attributeId, attributeOptionId)`,
  `createdAt`/`updatedAt`. `string | null` ტიპის ველებზე TypeORM-ს
  ცალსახად სჭირდება `type:` (`'uuid'`/`'varchar'`) — union ტიპზე
  reflect-metadata `Object`-ს აბრუნებს და `DataTypeNotSupportedError`
  გამოდის, თუ არ მიეთითება (იგივე პატერნი, რაც `CategoryAttribute.
  isRequiredOverride`-ს ჰქონდა boolean-ისთვის).
- `ProductsService`-ს დაემატა: `getAttributeValues` (მარტივი `find` +
  `attribute`/`attributeOption` relations), `setAttributeValues` — bulk
  set, რომელიც DTO-ს მთლიანად ცვლის (`delete` + `create`/`save`):
  1) მოაქვს პროდუქტის კატეგორიის ეფექტური attribute set
     (`CategoryService.findAttributesForCategory` — მემკვიდრეობის
     ჩათვლით, `AttributeModule`-ის იმპორტის გარეშე, `CategoryModule`-ის
     already-exported `CategoryService`-ით),
  2) ამოწმებს ყველა სავალდებულო (`isRequiredOverride ?? attribute.
     isRequired`) attribute-ის დაფარვას,
  3) ამოწმებს ყოველ გადმოცემულ attributeId-ს ეკუთვნის თუ არა კატეგორიის
     set-ს,
  4) `attribute.type`-ის მიხედვით ავალდებულებს შესაბამის value-ველს
     (`select`→`attributeOptionId`, `multi_select`→`attributeOptionIds[]`
     — თითო option-ზე ცალკე row, `number`/`range`→`valueNumber`,
     `text`→`valueText`, `boolean`→`valueBoolean`) და ამოწმებს
     option-ების კუთვნილებას სწორ attribute-თან.
- `ProductsController`-ს დაემატა: `GET /products/:id/attribute-values`
  (საჯარო), `PUT /products/:id/attribute-values` (`JwtAuthGuard` +
  `RolesGuard` + `@Roles(ADMIN)`) — `SetProductAttributeValuesDto`
  (`values: ProductAttributeValueItemDto[]`).
- `ProductsModule`-ს დაემატა `TypeOrmModule.forFeature([Product,
  ProductAttributeValue])` + `CategoryModule` იმპორტი (არა `AttributeModule`
  — `CategoryService`-ის `findAttributesForCategory`-ით საკმარისია;
  ციკლური დამოკიდებულება არ იქმნება, `CategoryModule` `ProductsModule`-ს
  არ იმპორტავს).
- Migration `1787762950000-AddProductAttributeValue` — `product_attribute_value`
  ცხრილი + 3 FK (`product`/`attribute`/`attribute_option`-ზე, ყველა
  `onDelete: CASCADE`) + composite unique constraint.
- გატესტილია dev DB-ზე (docker `shop_postgres`), ცოცხალი admin curl-ტესტით
  (ტესტ admin მომხმარებელი დროებით შეიქმნა და წაიშალა სესიის ბოლოს):
  schema `synchronize`-ით შეიქმნა, `DataTypeNotSupportedError` აღმოჩენილი
  და გასწორებული (იხ. ზემოთ), migration ხელით დაწერილია ცოცხალ schema-ზე
  დაყრდნობით და `migrations` ცხრილში ხელით ჩაიწერა (იგივე პატერნი, რაც
  ფაზა 1/3-ში) — `migration:generate` შემდეგ "No changes" (drift-check
  სუფთაა). `yarn build` სუფთაა. სრული end-to-end flow (კატეგორია →
  select/text attribute + option → category-attribute link → product →
  attribute-values): სავალდებულო attribute-ის გამოტოვება (400), უცნობი
  attributeId (400), სწორი bulk set (200, orderBy-ის გარეშე ორივე row
  სწორად დაბრუნდა), `GET` round-trip (200, relations ჩატვირთული), write
  ავტორიზაციის გარეშე (401) — ყველა დამოწმებულია.

## ფაზა 5 — შესრულებულია (2026-08-26) ✅

- ახალი entity/migration არ დასჭირდა — მხოლოდ read-only querybuilder-ზე
  დაფუძნებული endpoint-ები, არსებულ `Category`/`CategoryAttribute`/
  `Attribute`/`AttributeOption`/`Product`/`ProductAttributeValue`
  ცხრილებზე.
- `CategoryModule`-ს დაემატა `Product`/`ProductAttributeValue`
  (`AttributeOption` უკვე Attribute-ის `options` relation-ით იტვირთება)
  `TypeOrmModule.forFeature`-ში — იგივე "პირდაპირი repo-ის ინექცია
  service-ის სრული იმპორტის გარეშე" პატერნი, რაც ფაზა 3-ში (circular
  dependency არ იქმნება, `ProductsModule` `CategoryModule`-ს არ იმპორტავს
  Phase 5-ის endpoint-ებისთვის).
- `CategoryService`-ს დაემატა:
  - `getSubtreeCategoryIds(baseCategory, query)` — `?subcategory=slug`-ის
    დამუშავება (base-ის subtree-ს ქვეშ უნდა იყოს, თორემ 400/404) და
    `TreeRepository.findDescendants`-ით საბოლოო subtree category id-ების
    სია;
  - `getEffectiveFilterableAttributes(baseCategory, categoryIds)` —
    `isFilterable=true` attribute-ების union (ბაზის წინაპრები +
    მთელი subtree-ს category_attribute row-ები, დუბლირების გარეშე;
    "საკუთარი overrides წინაპარს" მემკვიდრეობის ლოგიკა აქ საჭირო არაა,
    მხოლოდ სრული სია გვინდა);
  - `buildFilteredProductsQuery(categoryIds, query, attributesByCode,
    excludeAttributeCode?)` — ბაზური `Product` querybuilder (subtree +
    `isActive` + search/min-max price), + დინამიური `INNER JOIN
    product_attribute_value`-ები თითო აქტიურ attribute-ფილტრზე
    (`?<code>=option1,option2` select/multi_select-ისთვის OR-მატჩი,
    `?<code>_min`/`?<code>_max` number/range-ისთვის, `?<code>=true|false`
    boolean-ისთვის, `?<code>=text` text-ისთვის substring-ით).
    `excludeAttributeCode` faceted count-ისთვისაა — attribute-ს საკუთარ
    ფილტრს არ ვუყენებთ, რომ იმავე attribute-ის დარჩენილი option-ების
    counts-იც გამოჩნდეს;
  - `getFilters(slug, query)` — თითო filterable attribute-ზე
    `buildFilteredProductsQuery(..., excludeAttributeCode: attribute.code)`
    + დამატებითი `INNER JOIN`/`GROUP BY` `product_attribute_value`-ზე:
    select/multi_select → თითო option-ის `COUNT(DISTINCT product.id)`,
    number/range → `MIN`/`MAX`, boolean → true/false count, text →
    ფილტრის სია count-ის გარეშე;
  - `getProductsForCategory(slug, query)` — იგივე
    `buildFilteredProductsQuery` (ყველა აქტიური ფილტრით), + pagination
    (`page`/`limit`/`sortBy`/`order`, ხელით parse-ილი — იხ. ქვემოთ) →
    `PaginatedResponseDto<Product>`.
- `CategoryController`-ს დაემატა `GET /categories/:slug/filters` და
  `GET /categories/:slug/products` (ორივე საჯარო). Query-ის ტიპი
  `CategoryFiltersQuery = Record<string, string>` (არა DTO class) —
  attribute-ის კოდები (`?brand=banner,mutlu&amperage_min=60`) წინასწარ
  უცნობია, სტატიკურ DTO-ში ვერ აღიწერება; გლობალური `ValidationPipe`
  (`whitelist: true, forbidNonWhitelisted: true`) მხოლოდ class metatype-ს
  ვალიდაციობს — plain `Record`/interface ტიპზე (runtime-ზე `Object`)
  ავტომატურად ითიშება, ისე რომ raw query object უცვლელად მიდის
  service-ში (page/limit/sortBy/order-იც იქ არის ხელით parse-ილი/
  დაცული, `SearchProductDto`-ს/`FindCategoriesDto`-ს ჩვეული
  class-validator ნაცვლად). `@Query() query: CategoryFiltersQuery`-ის
  ტიპი `import type`-ით არის შემოტანილი (`emitDecoratorMetadata` +
  `isolatedModules` ამიტომ ცალკე ტიპ-import-ს ითხოვს
  decorated პარამეტრებზე).
- გატესტილია dev DB-ზე ცოცხალი admin curl-ფლოუთი (parent+child
  კატეგორია, brand [select, parent-ზე], amperage [number, parent-ზე],
  waterproof [boolean, child-ზე] — მემკვიდრეობის შესამოწმებლად; 3
  პროდუქტი სხვადასხვა მნიშვნელობებით): `filters` ფილტრის გარეშე —
  სწორი counts/min-max ყველა attribute-ზე (inherited-იც ერთად); `filters`
  აქტიური `brand`-ფილტრით — დანარჩენი attribute-ების (`amperage`,
  `waterproof`) counts სწორად შეიცვალა აქტიური ფილტრის მიხედვით
  (`waterproof=false`-ის count 1-დან 0-მდე ჩავიდა, რადგან banner-ის
  არცერთ პროდუქტს waterproof=false არ აქვს) — faceted-count ლოგიკა
  დადასტურებულია; `products` — single/combined/OR-multi-value ფილტრები,
  pagination+sort, `?subcategory=`-ით შევიწროება, root/parent slug-იდან
  სრული subtree, არასწორი `subcategory` (400), უცნობი option-კოდი
  (0 შედეგი), უცნობი კატეგორია slug (404) — ყველა დამოწმებულია. `yarn
  build`/`yarn lint` (ახალ ფაილებზე) სუფთაა. ახალი migration არ
  დასჭირდა (read-only ცვლილება).

## ფაზა 7 — Frontend (`online-shop-next`) — შესრულებულია (2026-08-26) ✅

- **ეტაპი 0 (API client wiring)**: `API_Client/index.ts`-ში დაემატა
  `AttributesAPI` factory (`AttributesApi`-ის იმავე პატერნით, რაც
  `CategoriesAPI`/`ProductsAPI`-ს აქვს). `API_Client/types.ts`-ს დაემატა
  ხელნაწერი ტიპები (`Attribute`, `AttributeOption`, `CategoryAttribute`,
  `ProductAttributeValue`, `CategoryFilterEntry`/`CategoryFiltersResponse`)
  — generated client-ში ეს ყველა GET response `AxiosPromise<void>`-ია
  (query/response schema OpenAPI-ში არ არსებობს), ტიპები ცოცხალ dev
  ბექენდზე curl-ით გადამოწმებული ფორმის მიხედვით დაფიქსირდა. Filter/
  facet query პარამეტრები (`?brand=x&amperage_min=60` და pagination)
  გენერირებულ მეთოდებზე `options: { params: {...} }`-ის მეშვეობით
  გადადის (`createRequestFunction`-ი `axiosArgs.options`-ს პირდაპირ
  `axios.request`-ში აწვდის — გადამოწმებულია `API_Client/client/common.ts`-ში).
- **ეტაპი 1 (Admin: Attributes CRUD)**: ახალი
  `pages/dashboard/attributes.tsx` + `components/pages/dashboard/
  AttributesPage.tsx` (list/create/edit/delete + select/multi_select
  ტიპებზე inline options-მართვა), ახალი nav tab `DashboardLayout.tsx`-ში,
  `attributeFormSchema`/`attributeOptionFormSchema` `schemas.ts`-ში.
- **ეტაპი 2 (Admin: Category ↔ Attribute)**: `CategoriesPage.tsx`-ს
  დაემატა "მახასიათებლები" მოდალი თითო კატეგორიაზე — მიბმული
  attribute-ების სია (`categoryId`-ის შედარებით საკუთარი/მემკვიდრეობითის
  გარჩევით), დამატება/მოხსნა dropdown-ით.
- **ეტაპი 3 (Admin: Product attribute-values)**: ახალი
  `DynamicAttributeForm.tsx` კომპონენტი, ჩაშენებული `ProductsPage.tsx`-ის
  **edit** მოდალში (create-ში არა — მოითხოვს არსებულ `productId`-ს);
  `categoryId`-ის ცვლილებაზე ეფექტური attribute set ხელახლა იტვირთება.
- **ეტაპი 4 (Public: Category filter/facet გვერდი)**: ახალი route
  `pages/categories/[slug].tsx` → `components/pages/categoryProducts/
  index.tsx`, ახალი `hooks/useCategoryFilters.ts` (URL query ↔ filter
  state sync, debounce-ითურთ), ახალი `components/shared/FilterSidebar/`
  (select/multi_select checkbox+count, number/range min/max, boolean
  3-პოზიციური toggle, text ძებნა). არსებული `/products` კატალოგი
  უცვლელია.
- **ეტაპი 5 (Public: Product detail spec-ცხრილი)**: `productDetail/
  index.tsx`-ს დაემატა attribute-values ცხრილი (multi_select-ის
  group-ირებით attributeId-ის მიხედვით).
- **ვერიფიკაცია**: `yarn tsc --noEmit`/`yarn lint`/`yarn build:prod`
  სუფთაა ყველა ეტაპის შემდეგ. სრული e2e curl-ფლოუ ცოცხალ dev
  ბექენდზე (temp admin, დროებით შექმნილი და წაშლილი სესიის ბოლოს):
  attribute+option შექმნა → კატეგორიაზე მიბმა → პროდუქტზე
  attribute-value-ის დაწესება → `GET /categories/:slug/filters` (facet
  narrowing აქტიური ფილტრით) → `GET /categories/:slug/products`
  (`brand`+`amperage_min/max` კომბინირებული ფილტრი, სწორი 1/0 შედეგი) →
  `GET /products/:id/attribute-values` (spec-ცხრილისთვის) — ყველა
  frontend-ის ახალ კოდში ზუსტად გამოყენებული query/response ფორმით
  დამოწმებულია.

## მიმდინარე მდგომარეობა (2026-08-26-ის მდგომარეობით)

- `src/category/` — იერარქიული (closure-table), auth guard-ებით,
  attribute set-ითაც (`CategoryAttribute` join, მემკვიდრეობით
  წინაპრებისგან, ფაზა 3), ახლა + filter/facet endpoint-ებითაც (ფაზა 5).
- `src/products/` — მზადაა, სრული CRUD + pagination + role guards +
  querybuilder-ზე დაფუძნებული ფილტრები (`products.service.ts`), ახლა +
  `ProductAttributeValue`-ითაც (bulk set/get, ფაზა 4). `Product` →
  `Category` ჯერ კიდევ `ManyToOne` (`onDelete: SET NULL`) — many-to-many-ზე
  გადასვლა შეგნებულად გადავადებულია (Phase 4-ის scope-ის გადაწყვეტილებით).
- Attribute სისტემა: `Attribute`/`AttributeOption` (ფაზა 2),
  `CategoryAttribute` (ფაზა 3) და `ProductAttributeValue` (ფაზა 4)
  **სამივე მზადაა**, ფაზა 5-ის filter/facet querybuilder-ითურთ
  გამოყენებული.
- `src/common/` — `PaginationDto`/`PaginatedResponseDto`, `RolesGuard`,
  `@Roles`/`@CurrentUser` decorator-ები უკვე მზადაა, გამოსაყენებელია ახალ
  მოდულებშიც.
- `src/migrations/` — 9 არსებული migration (`AddProductAndCategoryLink`,
  `AddCart`, `AddOrders`, `AddPayments`, `AddCategoryHierarchy`,
  `AddProductVideoUrl`, `AddAttributeSystem`, `AddCategoryAttribute`,
  `AddProductAttributeValue`) — ფაზა 5-მა ახალი migration არ დაამატა
  (read-only). `synchronize` production-ში გამორთულია → ყოველი schema
  ცვლილება ახალ migration ფაილს საჭიროებს.
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

## 3. Frontend component structure (`online-shop-next`, ცალკე repo, ბექენდის შემდეგ) ✅
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
