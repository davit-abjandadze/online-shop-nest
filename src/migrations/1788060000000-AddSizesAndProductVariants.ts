import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSizesAndProductVariants1788060000000 implements MigrationInterface {
  name = 'AddSizesAndProductVariants1788060000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "size" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "translations" jsonb NOT NULL DEFAULT '{}',
        "code" character varying NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_size_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "product_variant" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "productId" integer NOT NULL,
        "colorId" uuid,
        "sizeId" uuid,
        "stock" integer NOT NULL DEFAULT 0,
        "price" numeric(10,2),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_product_variant_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_product_variant_product_color_size" UNIQUE ("productId", "colorId", "sizeId")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "product_variant"
      ADD CONSTRAINT "FK_product_variant_product"
      FOREIGN KEY ("productId") REFERENCES "product"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "product_variant"
      ADD CONSTRAINT "FK_product_variant_color"
      FOREIGN KEY ("colorId") REFERENCES "color"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "product_variant"
      ADD CONSTRAINT "FK_product_variant_size"
      FOREIGN KEY ("sizeId") REFERENCES "size"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "product_variant" DROP CONSTRAINT "FK_product_variant_size"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_variant" DROP CONSTRAINT "FK_product_variant_color"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_variant" DROP CONSTRAINT "FK_product_variant_product"`,
    );
    await queryRunner.query(`DROP TABLE "product_variant"`);
    await queryRunner.query(`DROP TABLE "size"`);
  }
}
