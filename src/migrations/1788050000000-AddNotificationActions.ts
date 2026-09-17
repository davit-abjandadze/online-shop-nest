import { MigrationInterface, QueryRunner } from 'typeorm';

// მოდალის ღილაკები (close/link) — Notification.actions, jsonb მასივი
// (NotificationActionDto[]). იხ. src/notifications/dto/notification-action.dto.ts.
export class AddNotificationActions1788050000000 implements MigrationInterface {
  name = 'AddNotificationActions1788050000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notification" ADD "actions" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "notification" DROP COLUMN "actions"`);
  }
}
