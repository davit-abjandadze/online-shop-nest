import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCategoryAttribute1787762900000 implements MigrationInterface {
  name = 'AddCategoryAttribute1787762900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "category_attribute" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "categoryId" uuid NOT NULL, "attributeId" uuid NOT NULL, "sortOrder" integer NOT NULL DEFAULT '0', "isRequiredOverride" boolean, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_f4f2de964c49011f9c7830913ae" UNIQUE ("categoryId", "attributeId"), CONSTRAINT "PK_e71950e2873d76c1fdb37b75b1b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "category_attribute" ADD CONSTRAINT "FK_6ae9fd1960af2eb3b290036c1c8" FOREIGN KEY ("categoryId") REFERENCES "category"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "category_attribute" ADD CONSTRAINT "FK_02d2d1bd2127e4d54302549fefd" FOREIGN KEY ("attributeId") REFERENCES "attribute"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "category_attribute" DROP CONSTRAINT "FK_02d2d1bd2127e4d54302549fefd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "category_attribute" DROP CONSTRAINT "FK_6ae9fd1960af2eb3b290036c1c8"`,
    );
    await queryRunner.query(`DROP TABLE "category_attribute"`);
  }
}
