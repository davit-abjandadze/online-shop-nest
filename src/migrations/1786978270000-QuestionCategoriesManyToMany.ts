import { MigrationInterface, QueryRunner } from 'typeorm';

// კითხვასა და კატეგორიას შორის კავშირი ManyToOne (question.categoryId)-დან
// ManyToMany-ზე გადადის (join table: question_categories), რომ ერთ კითხვას
// რამდენიმე კატეგორია დაუკავშირდეს.
export class QuestionCategoriesManyToMany1786978270000 implements MigrationInterface {
  name = 'QuestionCategoriesManyToMany1786978270000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "question_categories" ("questionId" integer NOT NULL, "categoryId" integer NOT NULL, CONSTRAINT "PK_question_categories" PRIMARY KEY ("questionId", "categoryId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_question_categories_questionId" ON "question_categories" ("questionId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_question_categories_categoryId" ON "question_categories" ("categoryId")`,
    );

    // არსებული ერთი-კატეგორია მონაცემების გადატანა join table-ში
    await queryRunner.query(
      `INSERT INTO "question_categories" ("questionId", "categoryId") SELECT "id", "categoryId" FROM "question" WHERE "categoryId" IS NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "question" DROP CONSTRAINT "FK_b8dd754e373b56714ddfa8f545c"`,
    );
    await queryRunner.query(`ALTER TABLE "question" DROP COLUMN "categoryId"`);

    await queryRunner.query(
      `ALTER TABLE "question_categories" ADD CONSTRAINT "FK_question_categories_question" FOREIGN KEY ("questionId") REFERENCES "question"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_categories" ADD CONSTRAINT "FK_question_categories_category" FOREIGN KEY ("categoryId") REFERENCES "category"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "question_categories" DROP CONSTRAINT "FK_question_categories_category"`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_categories" DROP CONSTRAINT "FK_question_categories_question"`,
    );

    await queryRunner.query(`ALTER TABLE "question" ADD "categoryId" integer`);

    // join table-დან პირველი (ნებისმიერი) მიბმული კატეგორიის დაბრუნება — ManyToOne-ს
    // ერთზე მეტი კატეგორიის შენახვა არ შეუძლია, ამიტომ დანარჩენები დაიკარგება
    await queryRunner.query(`
            UPDATE "question" q
            SET "categoryId" = sub."categoryId"
            FROM (
                SELECT DISTINCT ON ("questionId") "questionId", "categoryId"
                FROM "question_categories"
                ORDER BY "questionId", "categoryId"
            ) sub
            WHERE q."id" = sub."questionId"
        `);

    await queryRunner.query(
      `ALTER TABLE "question" ADD CONSTRAINT "FK_b8dd754e373b56714ddfa8f545c" FOREIGN KEY ("categoryId") REFERENCES "category"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `DROP INDEX "public"."IDX_question_categories_categoryId"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_question_categories_questionId"`,
    );
    await queryRunner.query(`DROP TABLE "question_categories"`);
  }
}
