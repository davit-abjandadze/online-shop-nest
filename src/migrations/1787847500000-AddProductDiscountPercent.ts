import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductDiscountPercent1787847500000 implements MigrationInterface {
  name = 'AddProductDiscountPercent1787847500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "product" ADD "discountPercent" integer`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "product" DROP COLUMN "discountPercent"`,
    );
  }
}
