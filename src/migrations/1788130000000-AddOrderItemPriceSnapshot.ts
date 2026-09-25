import { MigrationInterface, QueryRunner } from 'typeorm';

// OrderItem.originalUnitPrice/discountPercent — ფასდაკლებამდელი ფასის snapshot
// შეკვეთის მომენტში (ადრე ფრონტი მას პროდუქტის ცოცხალი price/discountPercent-იდან
// ითვლიდა, რაც ვარიანტებზე და შემდგომ ცვლილებებზე მცდარ "ფასდაკლებას" აჩვენებდა).
// ძველ ჩანაწერებზე ორივე null რჩება — რეტროაქტიურად ზუსტად ვერ აღდგება.
export class AddOrderItemPriceSnapshot1788130000000 implements MigrationInterface {
  name = 'AddOrderItemPriceSnapshot1788130000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order_item" ADD COLUMN IF NOT EXISTS "originalUnitPrice" numeric(10,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_item" ADD COLUMN IF NOT EXISTS "discountPercent" integer`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order_item" DROP COLUMN IF EXISTS "discountPercent"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_item" DROP COLUMN IF EXISTS "originalUnitPrice"`,
    );
  }
}
