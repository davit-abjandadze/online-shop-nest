import { MigrationInterface, QueryRunner } from 'typeorm';
import { decrypt, hashForSearch } from '../common/utils/encryption.util';

// ⚠️ უსაფრთხოების ფიქსი (encryption.util.ts): User.phoneNumber აქამდე
// დეტერმინისტული AES-256-CBC-ით იშიფრებოდა სპეციალურად იმიტომ, რომ ciphertext-ზე
// უშუალოდ ტოლობითი WHERE (findByPhoneNumber) და DB-level UNIQUE მუშაობდა — მაგრამ
// დეტერმინისტული IV ნიშნავდა, რომ ერთი და იგივე ნომერი ყოველთვის ერთსა და იმავე
// ciphertext-ს იძლეოდა (ბაზის დამპზე წვდომის მქონეს ჩანაწერების კორელაციის
// საშუალებას აძლევდა). ახლა phoneNumber non-deterministic AES-256-GCM-ით
// იშიფრება (encryption.util.ts), ამიტომ ტოლობა/უნიკალურობა ცალკე blind-index
// სვეტზე (phoneNumberHash — HMAC-SHA256, დამოუკიდებელი წარმოებული key)
// გადავიტანეთ.
//
// ეს მიგრაცია: (1) ამატებს phoneNumberHash სვეტს; (2) backfill-ს უკეთებს
// არსებულ ჩანაწერებს (ძველი ჩანაწერების phoneNumber ჯერ კიდევ ძველი
// დეტერმინისტული ფორმატითაა — decrypt() ორივე ფორმატს ცნობს, იხ.
// encryption.util.ts); (3) UNIQUE-ს დებს phoneNumberHash-ზე; (4) შლის ძველ
// UNIQUE შეზღუდვას phoneNumber-ზე, რომელიც non-deterministic ciphertext-ზე
// უკვე აზრს კარგავს (ორი სხვადასხვა ჩანაწერი ერთი და იმავე plaintext-ითაც კი
// განსხვავებულ ciphertext-ს მიიღებდა).
//
// batching: EncryptUserPii1787970000000-ის იგივე keyset-pagination პატერნი —
// მთელი ცხრილი არ იტვირთება ერთდროულად მეხსიერებაში.
const CHUNK_SIZE = 500;

export class AddPhoneNumberBlindIndex1787990000000 implements MigrationInterface {
  name = 'AddPhoneNumberBlindIndex1787990000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "phoneNumberHash" character varying`,
    );

    let lastId = 0;
    for (;;) {
      const rows = (await queryRunner.query(
        `SELECT "id", "phoneNumber" FROM "user"
           WHERE "id" > $1 AND "phoneNumber" IS NOT NULL
           ORDER BY "id"
           LIMIT ${CHUNK_SIZE}`,
        [lastId],
      )) as { id: number; phoneNumber: string }[];

      if (rows.length === 0) break;
      lastId = rows[rows.length - 1].id;

      const chunk = rows.map((row) => ({
        id: row.id,
        phoneNumberHash: hashForSearch(decrypt(row.phoneNumber)),
      }));

      const valuesSql = chunk
        .map((_, idx) => `($${idx * 2 + 1}::int, $${idx * 2 + 2}::text)`)
        .join(', ');
      const params: unknown[] = chunk.flatMap((v) => [v.id, v.phoneNumberHash]);

      await queryRunner.query(
        `UPDATE "user" AS u SET "phoneNumberHash" = v."phoneNumberHash"
         FROM (VALUES ${valuesSql}) AS v(id, "phoneNumberHash")
         WHERE u.id = v.id`,
        params,
      );

      if (rows.length < CHUNK_SIZE) break;
    }

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_user_phoneNumberHash" ON "user" ("phoneNumberHash")`,
    );

    // ძველი UNIQUE შეზღუდვა phoneNumber-ზე (სახელი synchronize-ის დროს
    // ავტომატურადაა გენერირებული, environment-ს შორის შესაძლოა განსხვავდებოდეს)
    // — დინამიურად ვპოულობთ pg_constraint-იდან და ვშლით, თუ საერთოდ არსებობს.
    await queryRunner.query(`
      DO $$
      DECLARE
        constraint_name text;
      BEGIN
        SELECT conname INTO constraint_name
        FROM pg_constraint
        WHERE conrelid = '"user"'::regclass
          AND contype = 'u'
          AND conkey = ARRAY[
            (SELECT attnum FROM pg_attribute
               WHERE attrelid = '"user"'::regclass AND attname = 'phoneNumber')
          ];
        IF constraint_name IS NOT NULL THEN
          EXECUTE format('ALTER TABLE "user" DROP CONSTRAINT %I', constraint_name);
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_user_phoneNumberHash"`);
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN IF EXISTS "phoneNumberHash"`,
    );
    // შენიშვნა: ძველი UNIQUE(phoneNumber) შეზღუდვას განზრახ არ ვაბრუნებთ —
    // phoneNumber ამ დროისთვის უკვე non-deterministic ciphertext-ს შეიცავს,
    // ასეთ UNIQUE-ს პრაქტიკული აზრი აღარ აქვს.
  }
}
