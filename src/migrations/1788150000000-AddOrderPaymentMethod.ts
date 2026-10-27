import { MigrationInterface, QueryRunner } from 'typeorm';

// Order.paymentMethod — ბარათის გარდა ადგილზე გადახდა და საბანკო გადარიცხვა.
// არსებული შეკვეთები ყველა ბარათით იყო, ამიტომ DEFAULT 'card' მათაც სწორად ავსებს.
export class AddOrderPaymentMethod1788150000000 implements MigrationInterface {
  name = 'AddOrderPaymentMethod1788150000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."order_paymentmethod_enum" AS ENUM('card', 'cash_on_delivery', 'bank_transfer')`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ADD "paymentMethod" "public"."order_paymentmethod_enum" NOT NULL DEFAULT 'card'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "order" DROP COLUMN "paymentMethod"`);
    await queryRunner.query(`DROP TYPE "public"."order_paymentmethod_enum"`);
  }
}
