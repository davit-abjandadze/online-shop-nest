import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBranchesAndOrderDelivery1787860000000
  implements MigrationInterface
{
  name = 'AddBranchesAndOrderDelivery1787860000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "branch" (
        "id" SERIAL NOT NULL,
        "title" character varying NOT NULL,
        "address" character varying NOT NULL,
        "phoneNumber" character varying NOT NULL,
        "email" character varying,
        "latitude" numeric(10,6) NOT NULL,
        "longitude" numeric(10,6) NOT NULL,
        "workingHours" jsonb NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "sortOrder" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_branch_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE TYPE "public"."order_deliverymethod_enum" AS ENUM('courier', 'pickup')`,
    );
    await queryRunner.query(`
      ALTER TABLE "order"
      ADD "deliveryMethod" "public"."order_deliverymethod_enum" NOT NULL DEFAULT 'courier'
    `);
    await queryRunner.query(`ALTER TABLE "order" ADD "branchId" integer`);
    await queryRunner.query(`
      ALTER TABLE "order"
      ADD CONSTRAINT "FK_order_branch"
      FOREIGN KEY ("branchId") REFERENCES "branch"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);
    await queryRunner.query(
      `ALTER TABLE "order" ALTER COLUMN "shippingAddress" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order" ALTER COLUMN "shippingAddress" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" DROP CONSTRAINT "FK_order_branch"`,
    );
    await queryRunner.query(`ALTER TABLE "order" DROP COLUMN "branchId"`);
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN "deliveryMethod"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."order_deliverymethod_enum"`,
    );
    await queryRunner.query(`DROP TABLE "branch"`);
  }
}
