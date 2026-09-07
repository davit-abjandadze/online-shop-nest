import { MigrationInterface, QueryRunner } from 'typeorm';

// ⚠️ ფიქსი: PaymentsService.handleCallback ყოველ BOG callback-ზე
// findOne({ where: { providerOrderId }})-ს იძახებს — ინდექსის გარეშე ეს
// sequential scan-ს ცხრილის ზრდასთან ერთად, და ვერაფერი უშლიდა ხელს ორ
// სხვადასხვა Payment row-ს ერთი და იმავე providerOrderId ჰქონოდა.
// providerOrderId nullable-ია (payment.entity.ts) — Postgres-ის unique
// ინდექსი მრავალ NULL-ს უშვებს, ამიტომ ჯერ initiate() არ გავლილ
// Payment-ებზე ეს არ აისახება.
export class AddPaymentProviderOrderIdUniqueIndex1788000000000 implements MigrationInterface {
  name = 'AddPaymentProviderOrderIdUniqueIndex1788000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_payment_providerOrderId" ON "payment" ("providerOrderId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_payment_providerOrderId"`,
    );
  }
}
