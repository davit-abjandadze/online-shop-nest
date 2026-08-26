import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductAttributeValue1787762950000 implements MigrationInterface {
  name = 'AddProductAttributeValue1787762950000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "product_attribute_value" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "productId" integer NOT NULL, "attributeId" uuid NOT NULL, "attributeOptionId" uuid, "valueText" character varying, "valueNumber" numeric(12,2), "valueBoolean" boolean, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_4171921ddbf76b6141a3ae8c27b" UNIQUE ("productId", "attributeId", "attributeOptionId"), CONSTRAINT "PK_b95764a58737e9768a0a79ff1a6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_attribute_value" ADD CONSTRAINT "FK_ec16da8811dbb98daf542e62370" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_attribute_value" ADD CONSTRAINT "FK_72a07a05e866d7f19ddb2457127" FOREIGN KEY ("attributeId") REFERENCES "attribute"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_attribute_value" ADD CONSTRAINT "FK_dc194249d4ec0404d21f9afe6a0" FOREIGN KEY ("attributeOptionId") REFERENCES "attribute_option"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "product_attribute_value" DROP CONSTRAINT "FK_dc194249d4ec0404d21f9afe6a0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_attribute_value" DROP CONSTRAINT "FK_72a07a05e866d7f19ddb2457127"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_attribute_value" DROP CONSTRAINT "FK_ec16da8811dbb98daf542e62370"`,
    );
    await queryRunner.query(`DROP TABLE "product_attribute_value"`);
  }
}
