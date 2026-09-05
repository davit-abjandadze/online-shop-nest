import { MigrationInterface, QueryRunner } from 'typeorm';

// სქემის ცვლილებები User-ზე, რომლებსაც dev-ში `synchronize: true` თავად აწყობს,
// production-ში კი (synchronize: false, migrationsRun: true — იხ. app.module.ts)
// მხოლოდ მიგრაცია მოაქვს:
//
// 1. `passwordChangedAt` — ახალი სვეტი JWT-ების ინვალიდაციისთვის
//    (იხ. JwtStrategy.validate, UsersService.updatePassword). ამ სვეტის გარეშე
//    production-ში User-ის ყოველი SELECT ჩავარდება
//    („column User.passwordChangedAt does not exist“), ანუ ავტორიზაცია მთლიანად.
//
// 2. `personalNumber`/`phoneNumber` სვეტების გაფართოება — ეს ველები ახლა
//    დაშიფრულად ინახება (encryptedColumnTransformer, base64-ში ~44 სიმბოლო),
//    ხოლო `personalNumber` ადრე `varchar(11)` იყო. ამ ALTER-ის გარეშე მომდევნო
//    მიგრაცია (EncryptUserPii, backfill) ჩავარდებოდა
//    „value too long for type character varying(11)“-ით.
//
// ⚠️ თანმიმდევრობა მნიშვნელოვანია: ეს მიგრაცია EncryptUserPii-ზე ადრე უნდა
// გაეშვას, ამიტომ timestamp-ი მისაზე ნაკლებია (1787965000000 < 1787970000000).
export class AddUserPasswordChangedAtAndWidenPii1787965000000 implements MigrationInterface {
  name = 'AddUserPasswordChangedAtAndWidenPii1787965000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // IF NOT EXISTS / IF EXISTS — რომ იმ ბაზებზეც უპრობლემოდ გაირბინოს, სადაც
    // ეს ცვლილებები `synchronize`-მა უკვე გააკეთა (ლოკალური/staging გარემო).
    await queryRunner.query(
      `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "passwordChangedAt" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "personalNumber" TYPE character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "phoneNumber" TYPE character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // სვეტს ვაბრუნებთ, ტიპებს კი განზრახ არა: `varchar(11)`-ზე დაბრუნება
    // დაშიფრულ მნიშვნელობებს ვერ დაიტევდა და მონაცემებს დაკარგავდა.
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN IF EXISTS "passwordChangedAt"`,
    );
  }
}
