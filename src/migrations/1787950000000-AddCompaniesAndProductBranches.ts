import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCompaniesAndProductBranches1787950000000 implements MigrationInterface {
  name = 'AddCompaniesAndProductBranches1787950000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "company" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "description" character varying,
        "logoUrl" character varying,
        "isActive" boolean NOT NULL DEFAULT true,
        "sortOrder" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_company_id" PRIMARY KEY ("id")
      )
    `);

    // branch.companyId — NOT NULL, ყოველ ფილიალს კომპანია უნდა ჰქონდეს
    // (ვვარაუდობთ, რომ ამ მიგრაციამდე production-ში ფილიალები ჯერ არ
    // არსებობდა — თუ არსებობს, ამ ALTER-ის წინ ხელით backfill დასჭირდება).
    await queryRunner.query(`ALTER TABLE "branch" ADD "companyId" uuid`);
    await queryRunner.query(`
      ALTER TABLE "branch"
      ADD CONSTRAINT "FK_branch_company"
      FOREIGN KEY ("companyId") REFERENCES "company"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(
      `ALTER TABLE "branch" ALTER COLUMN "companyId" SET NOT NULL`,
    );

    // product.companyId — nullable (category-ის იგივე SET NULL პატერნი),
    // ბიზნეს-წესის დონეზე (CreateProductDto) სავალდებულოა შექმნისას.
    await queryRunner.query(`ALTER TABLE "product" ADD "companyId" uuid`);
    await queryRunner.query(`
      ALTER TABLE "product"
      ADD CONSTRAINT "FK_product_company"
      FOREIGN KEY ("companyId") REFERENCES "company"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE "product_branch" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "productId" integer NOT NULL,
        "branchId" integer NOT NULL,
        "stock" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_product_branch_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_product_branch_product_branch" UNIQUE ("productId", "branchId")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "product_branch"
      ADD CONSTRAINT "FK_product_branch_product"
      FOREIGN KEY ("productId") REFERENCES "product"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "product_branch"
      ADD CONSTRAINT "FK_product_branch_branch"
      FOREIGN KEY ("branchId") REFERENCES "branch"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "product_branch" DROP CONSTRAINT "FK_product_branch_branch"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_branch" DROP CONSTRAINT "FK_product_branch_product"`,
    );
    await queryRunner.query(`DROP TABLE "product_branch"`);

    await queryRunner.query(
      `ALTER TABLE "product" DROP CONSTRAINT "FK_product_company"`,
    );
    await queryRunner.query(`ALTER TABLE "product" DROP COLUMN "companyId"`);

    await queryRunner.query(
      `ALTER TABLE "branch" DROP CONSTRAINT "FK_branch_company"`,
    );
    await queryRunner.query(`ALTER TABLE "branch" DROP COLUMN "companyId"`);

    await queryRunner.query(`DROP TABLE "company"`);
  }
}
