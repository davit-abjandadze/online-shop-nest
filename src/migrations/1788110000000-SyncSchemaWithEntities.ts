import { MigrationInterface, QueryRunner } from 'typeorm';

// entity-ებსა და მიგრაციების ჯაჭვს შორის დაგროვილი სხვაობის (drift) დახურვა.
// dev-ში `synchronize: true` ყველაფერს თავად აწყობდა, ამიტომ ეს სხვაობა
// ლოკალურად არ ჩანდა — production-ში კი (synchronize: false, migrationsRun:
// true) ცარიელ ბაზაზე აკლდა:
//
// 1. ცხრილები favorite, hero_slide, product_slider, product_slider_item,
//    product_additional_info — შესაბამისი endpoint-ები 500-ს დააბრუნებდა.
// 2. სვეტები user.isEmailVerified/isPhoneVerified, product.weight/length/width —
//    TypeORM ყველა mapped სვეტს SELECT-ში სვამს, ანუ user/product-ის ყოველი
//    query (login/register-ის ჩათვლით) ჩავარდებოდა.
// 3. payment_provider_enum-ის 'mock' მნიშვნელობა — MockPaymentProvider-ით
//    Payment-ის ჩაწერა ჩავარდებოდა.
// 4. ხელით დარქმეული FK/unique/index სახელები, რომლებიც TypeORM-ის
//    გენერირებულს არ ემთხვეოდა — სანამ არ გასწორდება, ყოველი მომავალი
//    `migration:generate` ამ ყველაფრის drop/re-create-ს დააგენერირებდა.
//    სახელებს ვცვლით (RENAME), არა drop/create-ით — მონაცემი/ინდექსი ხელახლა
//    არ იგება.
// 5. order_item.companyId-ის FK ვშლით: ეს snapshot-ია (იხ. OrderItem), entity-ზე
//    relation არ აქვს და FK-ის SET NULL კომპანიის წაშლისას სწორედ იმ ისტორიულ
//    მნიშვნელობას წაშლიდა, რისთვისაც snapshot არსებობს. ინდექსი რჩება.
//
// ყველა ნაბიჯი idempotent-ია (IF NOT EXISTS / pg_constraint-ის შემოწმება) —
// ერთნაირად უნდა გაირბინოს როგორც ცარიელ ბაზაზე, ისე იმაზე, რომელიც
// `synchronize`-მა უკვე ააწყო (იქ ეს ობიექტები უკვე გენერირებული სახელებით
// არსებობს და შესაბამისი ნაბიჯები no-op-ია).

// [ცხრილი, ძველი (ხელით დარქმეული) სახელი, TypeORM-ის გენერირებული სახელი]
const CONSTRAINT_RENAMES: [string, string, string][] = [
  ['address', 'FK_address_user', 'FK_d25f1ea79e282cc8a42bd616aa3'],
  ['branch', 'FK_branch_company', 'FK_d916e8de3e93fdf6bd13c734237'],
  ['product', 'FK_product_company', 'FK_a331e634b87a7dbba2e7fccce19'],
  [
    'product_variant',
    'FK_product_variant_product',
    'FK_6e420052844edf3a5506d863ce6',
  ],
  [
    'product_variant',
    'FK_product_variant_color',
    'FK_646f2685fe07002ddfff1c5cb87',
  ],
  [
    'product_variant',
    'FK_product_variant_size',
    'FK_83181384731b20fa47ac6b2accb',
  ],
  [
    'product_variant',
    'UQ_product_variant_product_color_size',
    'UQ_4cb076fac2a3f3777637231c614',
  ],
  ['cart_item', 'FK_cart_item_color', 'FK_ffb99029c767e38b3ae34bb4019'],
  ['cart_item', 'FK_cart_item_variant', 'FK_943d70200de5fc5fc39792b9148'],
  [
    'notification',
    'FK_notification_createdByUserId',
    'FK_698b7a92b820472f6d1065814f1',
  ],
  [
    'notification_recipient',
    'FK_notification_recipient_notificationId',
    'FK_b4dfc095df59b1c99e7f2413f0f',
  ],
  [
    'notification_recipient',
    'FK_notification_recipient_userId',
    'FK_75862303042acff969623e22d09',
  ],
  [
    'order_status_history',
    'FK_order_status_history_orderId',
    'FK_689db3835e5550e68d26ca32676',
  ],
  [
    'order_status_history',
    'FK_order_status_history_changedById',
    'FK_995002806e351edfa1d8450d82c',
  ],
  ['order', 'FK_order_branch', 'FK_9d915a5cee9e0cfdf0d7fc3c30a'],
  ['order_item', 'FK_order_item_color', 'FK_7b161a67b3f1a34754e22136897'],
  ['order_item', 'FK_order_item_variant', 'FK_d6080269459158fb5f93afa3d4b'],
  [
    'product_branch',
    'FK_product_branch_product',
    'FK_9ec5e969b7ccb1fffbaf3f451ce',
  ],
  [
    'product_branch',
    'FK_product_branch_branch',
    'FK_daa6aed25d48e0dd48faa12fce2',
  ],
  [
    'product_branch',
    'FK_product_branch_variant',
    'FK_5cac5024f13a4c6bf8ceb028a28',
  ],
  [
    'product_branch',
    'FK_product_branch_color',
    'FK_91b3056048ebc8a7785905a63ec',
  ],
  [
    'product_color',
    'FK_product_color_product',
    'FK_7a1cefb85fba910888cf9a1a634',
  ],
  ['product_color', 'FK_product_color_color', 'FK_d76b385a61478aa9c5c6408f337'],
  [
    'product_color',
    'UQ_product_color_product_color',
    'UQ_9885cc35ff96747c316d60b506b',
  ],
];

// [ძველი სახელი, TypeORM-ის გენერირებული სახელი]
const INDEX_RENAMES: [string, string][] = [
  ['IDX_product_categoryId', 'IDX_ff0c0301a95e517153df97f681'],
  [
    'IDX_notification_recipient_userId_isRead',
    'IDX_a56ad52dd63a63d87960bec339',
  ],
  [
    'IDX_notification_recipient_notificationId_userId',
    'IDX_f450ae55634c29f6d32b1c9811',
  ],
  ['IDX_order_status_history_orderId', 'IDX_689db3835e5550e68d26ca3267'],
  ['IDX_order_status_history_changedById', 'IDX_995002806e351edfa1d8450d82'],
  [
    'IDX_order_status_history_orderId_createdAt',
    'IDX_be366be57f21391e49f42e0b18',
  ],
  ['IDX_order_userId', 'IDX_caabe91507b3379c7ba73637b8'],
  ['IDX_order_createdAt', 'IDX_7bb07d3c6e225d75d8418380f1'],
  ['IDX_payment_providerOrderId', 'IDX_acbf3880f5905e3ae814c35dab'],
  ['IDX_product_attribute_value_attributeId', 'IDX_72a07a05e866d7f19ddb245712'],
];

// [ცხრილი, სახელი, განსაზღვრება] — ახალი ცხრილების FK-ები
const NEW_FOREIGN_KEYS: [string, string, string][] = [
  [
    'favorite',
    'FK_83b775fdebbe24c29b2b5831f2d',
    `FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  ],
  [
    'favorite',
    'FK_b8e337759b77baa0a4055d1894e',
    `FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  ],
  [
    'hero_slide',
    'FK_4026fac889134a01258dd69aec9',
    `FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
  ],
  [
    'product_slider_item',
    'FK_97465156bad03fabe5983a71423',
    `FOREIGN KEY ("productSliderId") REFERENCES "product_slider"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  ],
  [
    'product_slider_item',
    'FK_8ce274ce637a45604bb0905f43b',
    `FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  ],
  [
    'product_additional_info',
    'FK_7090f89d7260dc688a9dc6d3969',
    `FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  ],
];

export class SyncSchemaWithEntities1788110000000 implements MigrationInterface {
  name = 'SyncSchemaWithEntities1788110000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 3. enum
    await queryRunner.query(
      `ALTER TYPE "public"."payment_provider_enum" ADD VALUE IF NOT EXISTS 'mock'`,
    );

    // 2. სვეტები
    await queryRunner.query(
      `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "isEmailVerified" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "isPhoneVerified" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "weight" numeric(10,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "length" numeric(10,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "width" numeric(10,2)`,
    );

    // 1. ცხრილები
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "favorite" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "userId" integer, "productId" integer, CONSTRAINT "UQ_f0e7bf803aa937033d10dc07ed4" UNIQUE ("userId", "productId"), CONSTRAINT "PK_495675cec4fb09666704e4f610f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "hero_slide" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "translations" jsonb NOT NULL DEFAULT '{}', "image" character varying NOT NULL, "buttonLink" character varying, "isActive" boolean NOT NULL DEFAULT true, "sortOrder" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "productId" integer, CONSTRAINT "PK_b4cf6f64a1a80e5424f088243d3" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "product_slider" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "key" character varying NOT NULL, "translations" jsonb NOT NULL DEFAULT '{}', "viewAllLink" character varying, "isActive" boolean NOT NULL DEFAULT true, "sortOrder" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_892b63d49c34bc0200d72747a89" UNIQUE ("key"), CONSTRAINT "PK_f35629e2f89db5e844b9860e44e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "product_slider_item" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "productSliderId" uuid NOT NULL, "productId" integer NOT NULL, "sortOrder" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_092c4c50f4cc8ebd6272b41aeae" UNIQUE ("productSliderId", "productId"), CONSTRAINT "PK_bf4bb7794beb02a049107126b06" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "product_additional_info" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "productId" integer NOT NULL, "title" character varying NOT NULL, "description" text NOT NULL, "sortOrder" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_dd343753cb5f700743684ba90a1" PRIMARY KEY ("id"))`,
    );
    for (const [table, name, definition] of NEW_FOREIGN_KEYS) {
      await queryRunner.query(
        `DO $$ BEGIN
           IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${name}') THEN
             ALTER TABLE "${table}" ADD CONSTRAINT "${name}" ${definition};
           END IF;
         END $$`,
      );
    }

    // 4. სახელების გასწორება
    for (const [table, oldName, newName] of CONSTRAINT_RENAMES) {
      await queryRunner.query(
        `DO $$ BEGIN
           IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${oldName}') THEN
             ALTER TABLE "${table}" RENAME CONSTRAINT "${oldName}" TO "${newName}";
           END IF;
         END $$`,
      );
    }
    for (const [oldName, newName] of INDEX_RENAMES) {
      await queryRunner.query(
        `ALTER INDEX IF EXISTS "public"."${oldName}" RENAME TO "${newName}"`,
      );
    }
    // phoneNumberHash-ზე migration-მა unique INDEX შექმნა, entity კი unique
    // CONSTRAINT-ს აცხადებს — ორივე ერთსა და იმავეს იცავს, მაგრამ generate
    // მათ სხვადასხვად ხედავს.
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."UQ_user_phoneNumberHash"`,
    );
    await queryRunner.query(
      `DO $$ BEGIN
         IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UQ_941d1f0970973de9a0bc69ac12e') THEN
           ALTER TABLE "user" ADD CONSTRAINT "UQ_941d1f0970973de9a0bc69ac12e" UNIQUE ("phoneNumberHash");
         END IF;
       END $$`,
    );

    // 5. order_item.companyId snapshot-ის FK
    await queryRunner.query(
      `ALTER TABLE "order_item" DROP CONSTRAINT IF EXISTS "FK_order_item_company"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // სახელების გადარქმევას და enum-ის მნიშვნელობას განზრახ არ ვაბრუნებთ:
    // Postgres-ში enum-იდან მნიშვნელობის ამოღება მთელი ტიპის ხელახლა შექმნას
    // მოითხოვს, სახელების დაბრუნება კი ფუნქციურად არაფერს ცვლის.
    await queryRunner.query(
      `ALTER TABLE "order_item" ADD CONSTRAINT "FK_order_item_company" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "product_additional_info"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "product_slider_item"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "product_slider"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "hero_slide"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "favorite"`);
    await queryRunner.query(
      `ALTER TABLE "product" DROP COLUMN IF EXISTS "width"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product" DROP COLUMN IF EXISTS "length"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product" DROP COLUMN IF EXISTS "weight"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN IF EXISTS "isPhoneVerified"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN IF EXISTS "isEmailVerified"`,
    );
  }
}
