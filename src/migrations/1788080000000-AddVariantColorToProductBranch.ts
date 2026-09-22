import { MigrationInterface, QueryRunner } from 'typeorm';

// ProductBranch (pickup-მარაგი) დღემდე მთლიანად დამოუკიდებელი განზომილება
// იყო ProductVariant/ProductColor-ისგან — ვარიანტიან პროდუქტზეც კი ერთი
// flat row/ფილიალი იმართებოდა, რაც checkout-ს (BranchesService.
// findAvailableForProducts, OrdersService.createFromCart) ვერ აძლევდა
// საშუალებას შეემოწმებინა კონკრეტულ ფერს/ზომას ჰქონდა თუ არა მარაგი იმ
// ფილიალში. ეს მიგრაცია: (1) ამატებს optional variantId/colorId ველებს,
// (2) backfill — ვარიანტიან პროდუქტების ძველი flat row-ებს შლის (ადმინმა
// წინასწარ დადასტურებული გადაწყვეტილებით თავიდან უნდა შეავსოს ახალი,
// per-variant ფორმით — პროპორციული განაწილება არ ხდება), (3) ძველ
// (productId, branchId) unique constraint-ს ცვლის სამი partial unique
// ინდექსით (flat/variant/color დაყოფა).
export class AddVariantColorToProductBranch1788080000000 implements MigrationInterface {
  name = 'AddVariantColorToProductBranch1788080000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "product_branch" ADD "variantId" uuid`,
    );
    await queryRunner.query(`ALTER TABLE "product_branch" ADD "colorId" uuid`);

    await queryRunner.query(`
      ALTER TABLE "product_branch"
      ADD CONSTRAINT "FK_product_branch_variant"
      FOREIGN KEY ("variantId") REFERENCES "product_variant"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "product_branch"
      ADD CONSTRAINT "FK_product_branch_color"
      FOREIGN KEY ("colorId") REFERENCES "color"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    // Backfill: ვარიანტიან პროდუქტებზე ძველი flat (variantId=null,
    // colorId=null) ProductBranch row-ები აზრს კარგავს — pickup-მარაგი
    // ახლა per-variant/per-color არის, თუმცა ეს row-ები ვერანაირად ვერ
    // მიესადაგება კონკრეტულ ვარიანტს ავტომატურად. მომხმარებელთან
    // დადასტურებული გადაწყვეტილებით (2026-09-23) — ეს row-ები იშლება,
    // ადმინმა თავიდან უნდა შეავსოს ახალი, per-variant ფორმით PUT
    // /products/:id/branches-ზე.
    await queryRunner.query(`
      DELETE FROM "product_branch" pb
      WHERE pb."variantId" IS NULL
        AND pb."colorId" IS NULL
        AND EXISTS (
          SELECT 1 FROM "product_variant" pv WHERE pv."productId" = pb."productId"
        )
    `);

    await queryRunner.query(
      `ALTER TABLE "product_branch" DROP CONSTRAINT "UQ_product_branch_product_branch"`,
    );

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_product_branch_flat" ON "product_branch" ("productId", "branchId")
      WHERE "variantId" IS NULL AND "colorId" IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_product_branch_variant" ON "product_branch" ("productId", "branchId", "variantId")
      WHERE "variantId" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_product_branch_color" ON "product_branch" ("productId", "branchId", "colorId")
      WHERE "colorId" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_product_branch_color"`);
    await queryRunner.query(`DROP INDEX "UQ_product_branch_variant"`);
    await queryRunner.query(`DROP INDEX "UQ_product_branch_flat"`);

    await queryRunner.query(`
      ALTER TABLE "product_branch"
      ADD CONSTRAINT "UQ_product_branch_product_branch" UNIQUE ("productId", "branchId")
    `);

    await queryRunner.query(
      `ALTER TABLE "product_branch" DROP CONSTRAINT "FK_product_branch_color"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_branch" DROP CONSTRAINT "FK_product_branch_variant"`,
    );

    await queryRunner.query(
      `ALTER TABLE "product_branch" DROP COLUMN "colorId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_branch" DROP COLUMN "variantId"`,
    );
  }
}
