import { MigrationInterface, QueryRunner } from 'typeorm';

// StatsService-ის (admin სტატისტიკის მოდული) query-ებისთვის საჭირო
// ინდექსები production-ში — dev/test-ში synchronize:true ამას entity-ებზე
// დამატებული @Index დეკორატორებით თავისთავად ქმნის.
// - order.createdAt — overview/revenue/status-breakdown ყველა endpoint-ი
//   ამ სვეტზე filter-ავს/date_trunc-ავს (BETWEEN :from AND :to).
// - order_status_history (orderId, createdAt) კომპოზიტური — Phase 4-ის
//   transition-times endpoint-ისთვის (LAG() OVER (PARTITION BY orderId
//   ORDER BY createdAt)).
export class AddStatsIndexes1788030000000 implements MigrationInterface {
  name = 'AddStatsIndexes1788030000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_order_createdAt" ON "order" ("createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_order_status_history_orderId_createdAt" ON "order_status_history" ("orderId", "createdAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_order_status_history_orderId_createdAt"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_order_createdAt"`);
  }
}
