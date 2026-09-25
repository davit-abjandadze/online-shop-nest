import { MigrationInterface, QueryRunner } from 'typeorm';

// Payment.redirectUrl/checkoutExpiresAt — ხელახალი initiate ცოცხალ checkout-ს
// ხელახლა იყენებს (იხ. PaymentsService.initiate, Payment entity).
export class AddPaymentCheckoutReuse1788120000000 implements MigrationInterface {
  name = 'AddPaymentCheckoutReuse1788120000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "redirectUrl" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "checkoutExpiresAt" TIMESTAMP`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payment" DROP COLUMN IF EXISTS "checkoutExpiresAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment" DROP COLUMN IF EXISTS "redirectUrl"`,
    );
  }
}
