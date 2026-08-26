import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductVideoUrl1787760825336 implements MigrationInterface {
  name = 'AddProductVideoUrl1787760825336';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "product" ADD "videoUrl" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "product" DROP COLUMN "videoUrl"`);
  }
}
