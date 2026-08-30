import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddColorToCartAndOrderItems1787880000000
  implements MigrationInterface
{
  name = 'AddColorToCartAndOrderItems1787880000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "cart_item" ADD "colorId" uuid`);
    await queryRunner.query(`
      ALTER TABLE "cart_item"
      ADD CONSTRAINT "FK_cart_item_color"
      FOREIGN KEY ("colorId") REFERENCES "color"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`ALTER TABLE "order_item" ADD "colorId" uuid`);
    await queryRunner.query(
      `ALTER TABLE "order_item" ADD "colorName" character varying`,
    );
    await queryRunner.query(`
      ALTER TABLE "order_item"
      ADD CONSTRAINT "FK_order_item_color"
      FOREIGN KEY ("colorId") REFERENCES "color"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order_item" DROP CONSTRAINT "FK_order_item_color"`,
    );
    await queryRunner.query(`ALTER TABLE "order_item" DROP COLUMN "colorName"`);
    await queryRunner.query(`ALTER TABLE "order_item" DROP COLUMN "colorId"`);

    await queryRunner.query(
      `ALTER TABLE "cart_item" DROP CONSTRAINT "FK_cart_item_color"`,
    );
    await queryRunner.query(`ALTER TABLE "cart_item" DROP COLUMN "colorId"`);
  }
}
