import { MigrationInterface, QueryRunner } from 'typeorm';

// კატეგორია ბრტყელიდან იერარქიულ (closure-table) სტრუქტურაზე გადადის —
// name/description სვეტები იშლება (ჩანაცვლდება nameKa/nameEn/slug-ით) და
// category.id integer-იდან uuid-ზე იცვლება, რაც product.categoryId-საც
// ატყვევებს (მისი მნიშვნელობები null-დება). ადრეულ ეტაპზე ვართ, production
// მონაცემები არ არსებობს — ამიტომ existing category/product->category
// კავშირების დაკარგვა მისაღებია.
export class AddCategoryHierarchy1787760462682 implements MigrationInterface {
  name = 'AddCategoryHierarchy1787760462682';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // uuid_generate_v4() ქვემოთ (category.id-ის default) ამ extension-ს
    // საჭიროებს — ცალკე არსად არ ჩართულა, ამიტომ აქ ვრწმუნდებით.
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(
      `CREATE TABLE "category_closure" ("id_ancestor" uuid NOT NULL, "id_descendant" uuid NOT NULL, CONSTRAINT "PK_8da8666fc72217687e9b4f4c7e9" PRIMARY KEY ("id_ancestor", "id_descendant"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4aa1348fc4b7da9bef0fae8ff4" ON "category_closure"  ("id_ancestor") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6a22002acac4976977b1efd114" ON "category_closure"  ("id_descendant") `,
    );
    // ძველი ბრტყელი test/seed მონაცემები (name/description-ით) ახალ
    // სქემასთან შესატყვისი არაა (nameKa/nameEn/slug სავალდებულოა) —
    // production მონაცემები არ არსებობს ამ ეტაპზე, ამიტომ უბრალოდ ვასუფთავებთ.
    await queryRunner.query(`DELETE FROM "category"`);
    await queryRunner.query(`ALTER TABLE "category" DROP COLUMN "name"`);
    await queryRunner.query(`ALTER TABLE "category" DROP COLUMN "description"`);
    await queryRunner.query(
      `ALTER TABLE "category" ADD "nameKa" character varying NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "category" ADD "nameEn" character varying NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "category" ADD "slug" character varying NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "category" ADD CONSTRAINT "UQ_cb73208f151aa71cdd78f662d70" UNIQUE ("slug")`,
    );
    await queryRunner.query(
      `ALTER TABLE "category" ADD "isActive" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `ALTER TABLE "category" ADD "sortOrder" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "category" ADD "image" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "category" ADD "seoTitle" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "category" ADD "seoDescription" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "category" ADD "seoKeywords" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "category" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "category" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(`ALTER TABLE "category" ADD "parentId" uuid`);
    await queryRunner.query(
      `ALTER TABLE "product" DROP CONSTRAINT "FK_ff0c0301a95e517153df97f6812"`,
    );
    await queryRunner.query(
      `ALTER TABLE "category" DROP CONSTRAINT "PK_9c4e4a89e3674fc9f382d733f03"`,
    );
    await queryRunner.query(`ALTER TABLE "category" DROP COLUMN "id"`);
    await queryRunner.query(
      `ALTER TABLE "category" ADD "id" uuid NOT NULL DEFAULT uuid_generate_v4()`,
    );
    await queryRunner.query(
      `ALTER TABLE "category" ADD CONSTRAINT "PK_9c4e4a89e3674fc9f382d733f03" PRIMARY KEY ("id")`,
    );
    await queryRunner.query(`ALTER TABLE "product" DROP COLUMN "categoryId"`);
    await queryRunner.query(`ALTER TABLE "product" ADD "categoryId" uuid`);
    await queryRunner.query(
      `ALTER TABLE "category" ADD CONSTRAINT "FK_d5456fd7e4c4866fec8ada1fa10" FOREIGN KEY ("parentId") REFERENCES "category"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product" ADD CONSTRAINT "FK_ff0c0301a95e517153df97f6812" FOREIGN KEY ("categoryId") REFERENCES "category"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "category_closure" ADD CONSTRAINT "FK_4aa1348fc4b7da9bef0fae8ff48" FOREIGN KEY ("id_ancestor") REFERENCES "category"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "category_closure" ADD CONSTRAINT "FK_6a22002acac4976977b1efd114a" FOREIGN KEY ("id_descendant") REFERENCES "category"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "category_closure" DROP CONSTRAINT "FK_6a22002acac4976977b1efd114a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "category_closure" DROP CONSTRAINT "FK_4aa1348fc4b7da9bef0fae8ff48"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product" DROP CONSTRAINT "FK_ff0c0301a95e517153df97f6812"`,
    );
    await queryRunner.query(
      `ALTER TABLE "category" DROP CONSTRAINT "FK_d5456fd7e4c4866fec8ada1fa10"`,
    );
    await queryRunner.query(`ALTER TABLE "product" DROP COLUMN "categoryId"`);
    await queryRunner.query(`ALTER TABLE "product" ADD "categoryId" integer`);
    await queryRunner.query(
      `ALTER TABLE "category" DROP CONSTRAINT "PK_9c4e4a89e3674fc9f382d733f03"`,
    );
    await queryRunner.query(`ALTER TABLE "category" DROP COLUMN "id"`);
    await queryRunner.query(`ALTER TABLE "category" ADD "id" SERIAL NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "category" ADD CONSTRAINT "PK_9c4e4a89e3674fc9f382d733f03" PRIMARY KEY ("id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "product" ADD CONSTRAINT "FK_ff0c0301a95e517153df97f6812" FOREIGN KEY ("categoryId") REFERENCES "category"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(`ALTER TABLE "category" DROP COLUMN "parentId"`);
    await queryRunner.query(`ALTER TABLE "category" DROP COLUMN "updatedAt"`);
    await queryRunner.query(`ALTER TABLE "category" DROP COLUMN "createdAt"`);
    await queryRunner.query(`ALTER TABLE "category" DROP COLUMN "seoKeywords"`);
    await queryRunner.query(
      `ALTER TABLE "category" DROP COLUMN "seoDescription"`,
    );
    await queryRunner.query(`ALTER TABLE "category" DROP COLUMN "seoTitle"`);
    await queryRunner.query(`ALTER TABLE "category" DROP COLUMN "image"`);
    await queryRunner.query(`ALTER TABLE "category" DROP COLUMN "sortOrder"`);
    await queryRunner.query(`ALTER TABLE "category" DROP COLUMN "isActive"`);
    await queryRunner.query(
      `ALTER TABLE "category" DROP CONSTRAINT "UQ_cb73208f151aa71cdd78f662d70"`,
    );
    await queryRunner.query(`ALTER TABLE "category" DROP COLUMN "slug"`);
    await queryRunner.query(`ALTER TABLE "category" DROP COLUMN "nameEn"`);
    await queryRunner.query(`ALTER TABLE "category" DROP COLUMN "nameKa"`);
    await queryRunner.query(
      `ALTER TABLE "category" ADD "description" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "category" ADD "name" character varying NOT NULL`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6a22002acac4976977b1efd114"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_4aa1348fc4b7da9bef0fae8ff4"`,
    );
    await queryRunner.query(`DROP TABLE "category_closure"`);
  }
}
