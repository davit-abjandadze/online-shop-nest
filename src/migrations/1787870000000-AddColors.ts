import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddColors1787870000000 implements MigrationInterface {
  name = 'AddColors1787870000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "color" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "nameKa" character varying NOT NULL,
        "nameEn" character varying NOT NULL,
        "hexCode" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_color_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "product_color" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "productId" integer NOT NULL,
        "colorId" uuid NOT NULL,
        "stock" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_product_color_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_product_color_product_color" UNIQUE ("productId", "colorId")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "product_color"
      ADD CONSTRAINT "FK_product_color_product"
      FOREIGN KEY ("productId") REFERENCES "product"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "product_color"
      ADD CONSTRAINT "FK_product_color_color"
      FOREIGN KEY ("colorId") REFERENCES "color"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "product_color" DROP CONSTRAINT "FK_product_color_color"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_color" DROP CONSTRAINT "FK_product_color_product"`,
    );
    await queryRunner.query(`DROP TABLE "product_color"`);
    await queryRunner.query(`DROP TABLE "color"`);
  }
}
