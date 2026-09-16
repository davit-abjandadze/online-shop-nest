import { MigrationInterface, QueryRunner } from 'typeorm';

// შეკვეთის სტატუსების ისტორია — ფრონტის order-tracking timeline-ისთვის
// (pending → paid → processing → shipped → delivered, cancelled/expired
// ტერმინალურია). OrdersService.recordStatusHistory ერთადერთი ადგილია,
// სადაც row ჩაწერის ხდება (createFromCart-ის საწყისი pending, updateStatus-ის
// ადმინის/BOG webhook-ის ცვლილება, expireStaleOrders-ის cron-ის expire).
export class AddOrderStatusHistory1788020000000 implements MigrationInterface {
  name = 'AddOrderStatusHistory1788020000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."order_status_history_status_enum" AS ENUM('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'expired')`,
    );
    await queryRunner.query(
      `CREATE TABLE "order_status_history" (
        "id" SERIAL NOT NULL,
        "status" "public"."order_status_history_status_enum" NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "orderId" integer NOT NULL,
        "changedById" integer,
        CONSTRAINT "PK_order_status_history_id" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_order_status_history_orderId" ON "order_status_history" ("orderId")`,
    );
    // ადმინის მიხედვით ფილტრაციისთვის (მომავალი აუდიტ-ფუნქციონალი — "ამ
    // ადმინმა რა შეცვალა") — ცალკე ინდექსი, orderId-ის ინდექსისგან
    // დამოუკიდებელი, ვინაიდან query-ები სხვადასხვა სვეტზე ხდება.
    await queryRunner.query(
      `CREATE INDEX "IDX_order_status_history_changedById" ON "order_status_history" ("changedById")`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_status_history" ADD CONSTRAINT "FK_order_status_history_orderId" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_status_history" ADD CONSTRAINT "FK_order_status_history_changedById" FOREIGN KEY ("changedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order_status_history" DROP CONSTRAINT "FK_order_status_history_changedById"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_status_history" DROP CONSTRAINT "FK_order_status_history_orderId"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_order_status_history_changedById"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_order_status_history_orderId"`);
    await queryRunner.query(`DROP TABLE "order_status_history"`);
    await queryRunner.query(
      `DROP TYPE "public"."order_status_history_status_enum"`,
    );
  }
}
