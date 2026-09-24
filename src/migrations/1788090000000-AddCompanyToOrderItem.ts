import { MigrationInterface, QueryRunner } from 'typeorm';

// order_item-ს ემატება companyId snapshot (product.companyId შეკვეთის
// შექმნის მომენტში) — StatsService-ს სჭირდება შემოსავლის კომპანიის
// მიხედვით ფილტრისთვის (order.totalAmount ვერ ფილტრდება პირდაპირ, რადგან
// company მხოლოდ Product-ზეა მიბმული, არა Order-ზე). colorId-ის იგივე
// SET NULL პატერნი — კომპანიის წაშლა ისტორიულ შეკვეთებს არ უნდა ანგრევდეს.
export class AddCompanyToOrderItem1788090000000 implements MigrationInterface {
  name = 'AddCompanyToOrderItem1788090000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "order_item" ADD "companyId" uuid`);
    await queryRunner.query(`
      ALTER TABLE "order_item"
      ADD CONSTRAINT "FK_order_item_company"
      FOREIGN KEY ("companyId") REFERENCES "company"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_order_item_companyId" ON "order_item" ("companyId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_order_item_companyId"`);
    await queryRunner.query(
      `ALTER TABLE "order_item" DROP CONSTRAINT "FK_order_item_company"`,
    );
    await queryRunner.query(`ALTER TABLE "order_item" DROP COLUMN "companyId"`);
  }
}
