import { MigrationInterface, QueryRunner } from 'typeorm';

// Order.stockRestored — cancel → reopen → cancel ციკლის (ან manual EXPIRED
// ტრანზაქციის) დროს მარაგის ორმაგი დაბრუნების/დაკარგვის ბაგის გამოსასწორებლად
// (იხ. OrdersService.updateStatus/expireStaleOrders). ისტორიულ, უკვე
// CANCELLED/EXPIRED შეკვეთებზე (რომელთა მარაგიც ისედაც უკვე დაბრუნებულია
// ძველი კოდით) default false-ს ვტოვებთ true-ზე backfill-ის გარეშე — ეს
// ველი მხოლოდ ამ მომენტიდან მომდევნო status-ცვლილებებზეა კრიტიკული.
export class AddOrderStockRestoredFlag1787980000000 implements MigrationInterface {
  name = 'AddOrderStockRestoredFlag1787980000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order" ADD COLUMN "stockRestored" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "order" DROP COLUMN "stockRestored"`);
  }
}
