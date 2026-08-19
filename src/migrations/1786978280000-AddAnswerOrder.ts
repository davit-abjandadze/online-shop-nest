import { MigrationInterface, QueryRunner } from 'typeorm';

// Answer entity-ს "order" ველი აქვს (პასუხების თანმიმდევრობა კითხვის ფარგლებში),
// მაგრამ InitialSchema migration-ში "answer" ცხრილის შექმნისას ეს სვეტი გამოტოვებული
// იყო — production-ში ნებისმიერი კითხვების query ("answers.order"-ზე ORDER BY-ით)
// 500-ით ეცემოდა (column answers.order does not exist).
export class AddAnswerOrder1786978280000 implements MigrationInterface {
  name = 'AddAnswerOrder1786978280000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "answer" ADD "order" integer NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "answer" DROP COLUMN "order"`);
  }
}
