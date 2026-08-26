import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAttributeSystem1787762861841 implements MigrationInterface {
  name = 'AddAttributeSystem1787762861841';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."attribute_type_enum" AS ENUM('select', 'multi_select', 'number', 'text', 'boolean', 'range')`,
    );
    await queryRunner.query(
      `CREATE TABLE "attribute" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "nameKa" character varying NOT NULL, "nameEn" character varying NOT NULL, "code" character varying NOT NULL, "type" "public"."attribute_type_enum" NOT NULL DEFAULT 'text', "unit" character varying, "isFilterable" boolean NOT NULL DEFAULT true, "isRequired" boolean NOT NULL DEFAULT false, "sortOrder" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_3c3dadeb70707dfe5a6b3fd7f85" UNIQUE ("code"), CONSTRAINT "PK_b13fb7c5c9e9dff62b60e0de729" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "attribute_option" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "attributeId" uuid NOT NULL, "valueKa" character varying NOT NULL, "valueEn" character varying NOT NULL, "code" character varying NOT NULL, "sortOrder" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_f82d2beda082d30595cef5dc398" UNIQUE ("attributeId", "code"), CONSTRAINT "PK_06630b72345d91a8e3cb5245a57" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "attribute_option" ADD CONSTRAINT "FK_0f970f7e5632357537ae1230ea8" FOREIGN KEY ("attributeId") REFERENCES "attribute"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "attribute_option" DROP CONSTRAINT "FK_0f970f7e5632357537ae1230ea8"`,
    );
    await queryRunner.query(`DROP TABLE "attribute_option"`);
    await queryRunner.query(`DROP TABLE "attribute"`);
    await queryRunner.query(`DROP TYPE "public"."attribute_type_enum"`);
  }
}
