import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVariantToCartAndOrderItems1788070000000 implements MigrationInterface {
  name = 'AddVariantToCartAndOrderItems1788070000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "cart_item" ADD "variantId" uuid`);
    await queryRunner.query(`
      ALTER TABLE "cart_item"
      ADD CONSTRAINT "FK_cart_item_variant"
      FOREIGN KEY ("variantId") REFERENCES "product_variant"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`ALTER TABLE "order_item" ADD "variantId" uuid`);
    await queryRunner.query(
      `ALTER TABLE "order_item" ADD "sizeName" character varying`,
    );
    await queryRunner.query(`
      ALTER TABLE "order_item"
      ADD CONSTRAINT "FK_order_item_variant"
      FOREIGN KEY ("variantId") REFERENCES "product_variant"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order_item" DROP CONSTRAINT "FK_order_item_variant"`,
    );
    await queryRunner.query(`ALTER TABLE "order_item" DROP COLUMN "sizeName"`);
    await queryRunner.query(`ALTER TABLE "order_item" DROP COLUMN "variantId"`);

    await queryRunner.query(
      `ALTER TABLE "cart_item" DROP CONSTRAINT "FK_cart_item_variant"`,
    );
    await queryRunner.query(`ALTER TABLE "cart_item" DROP COLUMN "variantId"`);
  }
}
