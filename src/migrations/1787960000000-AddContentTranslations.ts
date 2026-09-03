import { MigrationInterface, QueryRunner } from 'typeorm';

// Product/Category/Attribute/AttributeOption/Color-ის ცალკე nameKa/nameEn
// (ან valueKa/valueEn, product-ისთვის name/description) სვეტების ჩანაცვლება
// ერთი `translations` jsonb სვეტით — { ka: {...}, en?: {...}, ru?: {...} }.
// ru მანამდე საერთოდ არ არსებობდა, ამიტომ backfill მხოლოდ ka/en-ს ავსებს.
export class AddContentTranslations1787960000000
  implements MigrationInterface
{
  name = 'AddContentTranslations1787960000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- 1. ახალი სვეტის დამატება ------------------------------------
    await queryRunner.query(
      `ALTER TABLE "product" ADD "translations" jsonb NOT NULL DEFAULT '{}'`,
    );
    await queryRunner.query(
      `ALTER TABLE "category" ADD "translations" jsonb NOT NULL DEFAULT '{}'`,
    );
    await queryRunner.query(
      `ALTER TABLE "attribute" ADD "translations" jsonb NOT NULL DEFAULT '{}'`,
    );
    await queryRunner.query(
      `ALTER TABLE "attribute_option" ADD "translations" jsonb NOT NULL DEFAULT '{}'`,
    );
    await queryRunner.query(
      `ALTER TABLE "color" ADD "translations" jsonb NOT NULL DEFAULT '{}'`,
    );

    // --- 2. backfill ძველი ველებიდან ----------------------------------
    await queryRunner.query(`
      UPDATE "category"
      SET "translations" = jsonb_build_object(
        'ka', jsonb_build_object('name', "nameKa"),
        'en', jsonb_build_object('name', "nameEn")
      )
    `);
    await queryRunner.query(`
      UPDATE "attribute"
      SET "translations" = jsonb_build_object(
        'ka', jsonb_build_object('name', "nameKa"),
        'en', jsonb_build_object('name', "nameEn")
      )
    `);
    await queryRunner.query(`
      UPDATE "attribute_option"
      SET "translations" = jsonb_build_object(
        'ka', jsonb_build_object('value', "valueKa"),
        'en', jsonb_build_object('value', "valueEn")
      )
    `);
    await queryRunner.query(`
      UPDATE "color"
      SET "translations" = jsonb_build_object(
        'ka', jsonb_build_object('name', "nameKa"),
        'en', jsonb_build_object('name', "nameEn")
      )
    `);
    // product-ს en/ru მანამდე საერთოდ არ ჰქონდა — მხოლოდ ka ივსება.
    await queryRunner.query(`
      UPDATE "product"
      SET "translations" = jsonb_build_object(
        'ka', jsonb_build_object('name', "name", 'description', "description")
      )
    `);

    // --- 3. ძველი სვეტების წაშლა ---------------------------------------
    await queryRunner.query(`ALTER TABLE "category" DROP COLUMN "nameKa"`);
    await queryRunner.query(`ALTER TABLE "category" DROP COLUMN "nameEn"`);
    await queryRunner.query(`ALTER TABLE "attribute" DROP COLUMN "nameKa"`);
    await queryRunner.query(`ALTER TABLE "attribute" DROP COLUMN "nameEn"`);
    await queryRunner.query(
      `ALTER TABLE "attribute_option" DROP COLUMN "valueKa"`,
    );
    await queryRunner.query(
      `ALTER TABLE "attribute_option" DROP COLUMN "valueEn"`,
    );
    await queryRunner.query(`ALTER TABLE "color" DROP COLUMN "nameKa"`);
    await queryRunner.query(`ALTER TABLE "color" DROP COLUMN "nameEn"`);
    await queryRunner.query(`ALTER TABLE "product" DROP COLUMN "name"`);
    await queryRunner.query(`ALTER TABLE "product" DROP COLUMN "description"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // --- 1. ძველი სვეტების დაბრუნება ------------------------------------
    await queryRunner.query(
      `ALTER TABLE "category" ADD "nameKa" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "category" ADD "nameEn" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "attribute" ADD "nameKa" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "attribute" ADD "nameEn" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "attribute_option" ADD "valueKa" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "attribute_option" ADD "valueEn" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "color" ADD "nameKa" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "color" ADD "nameEn" character varying`,
    );
    await queryRunner.query(`ALTER TABLE "product" ADD "name" character varying`);
    await queryRunner.query(
      `ALTER TABLE "product" ADD "description" character varying`,
    );

    // --- 2. backfill translations-იდან ----------------------------------
    await queryRunner.query(`
      UPDATE "category"
      SET "nameKa" = "translations" -> 'ka' ->> 'name',
          "nameEn" = "translations" -> 'en' ->> 'name'
    `);
    await queryRunner.query(`
      UPDATE "attribute"
      SET "nameKa" = "translations" -> 'ka' ->> 'name',
          "nameEn" = "translations" -> 'en' ->> 'name'
    `);
    await queryRunner.query(`
      UPDATE "attribute_option"
      SET "valueKa" = "translations" -> 'ka' ->> 'value',
          "valueEn" = "translations" -> 'en' ->> 'value'
    `);
    await queryRunner.query(`
      UPDATE "color"
      SET "nameKa" = "translations" -> 'ka' ->> 'name',
          "nameEn" = "translations" -> 'en' ->> 'name'
    `);
    await queryRunner.query(`
      UPDATE "product"
      SET "name" = "translations" -> 'ka' ->> 'name',
          "description" = "translations" -> 'ka' ->> 'description'
    `);

    // --- 3. NOT NULL-ის დაბრუნება (backfill-ის შემდეგ) --------------------
    await queryRunner.query(
      `ALTER TABLE "category" ALTER COLUMN "nameKa" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "category" ALTER COLUMN "nameEn" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "attribute" ALTER COLUMN "nameKa" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "attribute" ALTER COLUMN "nameEn" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "attribute_option" ALTER COLUMN "valueKa" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "attribute_option" ALTER COLUMN "valueEn" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "color" ALTER COLUMN "nameKa" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "color" ALTER COLUMN "nameEn" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "product" ALTER COLUMN "name" SET NOT NULL`,
    );

    // --- 4. translations სვეტის წაშლა -----------------------------------
    await queryRunner.query(`ALTER TABLE "product" DROP COLUMN "translations"`);
    await queryRunner.query(
      `ALTER TABLE "category" DROP COLUMN "translations"`,
    );
    await queryRunner.query(
      `ALTER TABLE "attribute" DROP COLUMN "translations"`,
    );
    await queryRunner.query(
      `ALTER TABLE "attribute_option" DROP COLUMN "translations"`,
    );
    await queryRunner.query(`ALTER TABLE "color" DROP COLUMN "translations"`);
  }
}
