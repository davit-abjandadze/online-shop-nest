import { MigrationInterface, QueryRunner } from 'typeorm';

// Performance-აუდიტის #19: hot-path filter/join სვეტებზე ინდექსების არარსებობა —
// product.categoryId (GET /categories/:slug/products, getFilters()-ის subtree
// query), order.userId ("ჩემი შეკვეთები" / OrdersService-ის userId-ფილტრები),
// product_attribute_value.attributeId (getFilters()-ის per-attribute facet
// count queries) ინდექსის გარეშე sequential scan-ს გაუშვებდა ცხრილების
// ზრდასთან ერთად. dev/test-ში synchronize:true ამას თავისთავად ქმნის
// (entity-ებზე @Index დამატებულია) — ეს migration იმავეს აკეთებს production-ში.
export class AddPerformanceIndexes1788010000000 implements MigrationInterface {
  name = 'AddPerformanceIndexes1788010000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_product_categoryId" ON "product" ("categoryId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_order_userId" ON "order" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_product_attribute_value_attributeId" ON "product_attribute_value" ("attributeId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_product_attribute_value_attributeId"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_order_userId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_product_categoryId"`);
  }
}
