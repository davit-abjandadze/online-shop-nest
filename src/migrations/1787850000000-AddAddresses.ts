import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAddresses1787850000000 implements MigrationInterface {
  name = 'AddAddresses1787850000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "address" (
        "id" SERIAL NOT NULL,
        "title" character varying NOT NULL,
        "phoneNumber" character varying NOT NULL,
        "city" character varying NOT NULL,
        "address" character varying NOT NULL,
        "comment" character varying,
        "isDefault" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "userId" integer NOT NULL,
        CONSTRAINT "PK_address_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "address"
      ADD CONSTRAINT "FK_address_user"
      FOREIGN KEY ("userId") REFERENCES "user"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "address" DROP CONSTRAINT "FK_address_user"`,
    );
    await queryRunner.query(`DROP TABLE "address"`);
  }
}
