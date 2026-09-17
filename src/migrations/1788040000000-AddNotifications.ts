import { MigrationInterface, QueryRunner } from 'typeorm';

// ადმინის შეტყობინებების სისტემა (bell/dropdown/modal) — Notification +
// NotificationRecipient join-ცხრილი, თითო user-ს თავისი read-სტატუსით.
// იხ. plans/NOTIFICATIONS_PLAN.md, Phase B1.
export class AddNotifications1788040000000 implements MigrationInterface {
  name = 'AddNotifications1788040000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "notification" (
        "id" SERIAL NOT NULL,
        "title" character varying NOT NULL,
        "contentHtml" text NOT NULL,
        "imageUrl" character varying,
        "createdByUserId" integer,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notification_id" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification" ADD CONSTRAINT "FK_notification_createdByUserId" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "notification_recipient" (
        "id" SERIAL NOT NULL,
        "notificationId" integer NOT NULL,
        "userId" integer NOT NULL,
        "isRead" boolean NOT NULL DEFAULT false,
        "readAt" TIMESTAMP,
        CONSTRAINT "PK_notification_recipient_id" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_notification_recipient_notificationId_userId" ON "notification_recipient" ("notificationId", "userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notification_recipient_userId_isRead" ON "notification_recipient" ("userId", "isRead")`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification_recipient" ADD CONSTRAINT "FK_notification_recipient_notificationId" FOREIGN KEY ("notificationId") REFERENCES "notification"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification_recipient" ADD CONSTRAINT "FK_notification_recipient_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notification_recipient" DROP CONSTRAINT "FK_notification_recipient_userId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification_recipient" DROP CONSTRAINT "FK_notification_recipient_notificationId"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_notification_recipient_userId_isRead"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_notification_recipient_notificationId_userId"`,
    );
    await queryRunner.query(`DROP TABLE "notification_recipient"`);

    await queryRunner.query(
      `ALTER TABLE "notification" DROP CONSTRAINT "FK_notification_createdByUserId"`,
    );
    await queryRunner.query(`DROP TABLE "notification"`);
  }
}
