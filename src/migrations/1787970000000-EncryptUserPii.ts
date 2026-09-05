import { MigrationInterface, QueryRunner } from 'typeorm';
import {
  decryptStrict,
  encryptDeterministic,
} from '../common/utils/encryption.util';

// User.personalNumber/phoneNumber ბაზაში აქამდე plaintext ინახებოდა; ახლა
// entity-ზე მიბმულია encryptedColumnTransformer (AES-256-CBC, დეტერმინისტული IV —
// იხ. common/utils/encryption.util.ts), ანუ ORM-ის საშუალებით ჩაწერილი/წაკითხული
// ყველა მნიშვნელობა ავტომატურად შიფრდება/იშიფრება. უკვე არსებული, ჯერ კიდევ
// plaintext ჩანაწერების ერთჯერადი დაშიფვრა (backfill) სჭირდება — წინააღმდეგ
// შემთხვევაში ORM-ის decrypt() მათზე გაშიფვრის შეცდომით ჩავარდება (თუმცა
// encryptedColumnTransformer-ის უკან მდგომი decrypt() ახლა ლმობიერია და
// plaintext-ზე უცვლელად აბრუნებს მას — იხ. encryption.util.ts — ეს მიგრაცია
// მაინც საჭიროა, რომ ბაზაში PII რეალურად დაშიფრული ინახებოდეს).
//
// idempotency: ყოველ მნიშვნელობაზე ჯერ decryptStrict()-ს ვცდილობთ — თუ
// წარმატებულია, ის უკვე დაშიფრულია (მიგრაცია უკვე გაშვებულა/schema ახლიდან
// შექმნილა დაშიფრული მონაცემით) და მას გამოვტოვებთ; თუ decryptStrict ჩავარდება
// (რაც plaintext მნიშვნელობაზე თითქმის ყოველთვის ხდება — bad padding, ვინაიდან
// CBC-ის PKCS7 padding შემთხვევით plaintext ბაიტებზე პრაქტიკულად არასდროს
// ემთხვევა), ეს ნიშნავს, რომ ჯერ არ არის დაშიფრული და ვშიფრავთ.
//
// batching: ცხრილს CHUNK_SIZE-იან "ფანჯრებად" ვკითხულობთ (keyset pagination
// id-ზე) და თითოეულ ფანჯარას ერთ მრავალ-მწკრივიან UPDATE ... FROM (VALUES ...)-ს
// ვაბრუნებთ — ასე არც DB round-trip-ებია ბევრი და, რაც მთავარია, მთელი ცხრილი
// ერთდროულად Node-ის მეხსიერებაში არ ჯდება (production-ში ეს მიგრაცია
// migrationsRun-ით ავტომატურად ეშვება, ანუ OOM აპლიკაციის აწყობას ჩაშლიდა).
// keyset (id > lastId) და არა OFFSET — რადგან ჩანაწერებს იმავე ტრანზაქციაში
// ვცვლით და OFFSET-ს მწკრივების გადალაგება გამოაცდენინებდა.
const CHUNK_SIZE = 500;

export class EncryptUserPii1787970000000 implements MigrationInterface {
  name = 'EncryptUserPii1787970000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    let lastId = 0;

    for (;;) {
      const rows = (await queryRunner.query(
        `SELECT "id", "personalNumber", "phoneNumber" FROM "user"
           WHERE "id" > $1
             AND ("personalNumber" IS NOT NULL OR "phoneNumber" IS NOT NULL)
           ORDER BY "id"
           LIMIT ${CHUNK_SIZE}`,
        [lastId],
      )) as {
        id: number;
        personalNumber: string | null;
        phoneNumber: string | null;
      }[];

      if (rows.length === 0) break;
      lastId = rows[rows.length - 1].id;

      const chunk = rows.map((row) => ({
        id: row.id,
        personalNumber:
          row.personalNumber !== null
            ? this.encryptIfNeeded(row.personalNumber)
            : null,
        phoneNumber:
          row.phoneNumber !== null
            ? this.encryptIfNeeded(row.phoneNumber)
            : null,
      }));

      const valuesSql = chunk
        .map(
          (_, idx) =>
            `($${idx * 3 + 1}::int, $${idx * 3 + 2}::text, $${idx * 3 + 3}::text)`,
        )
        .join(', ');
      const params: unknown[] = chunk.flatMap((v) => [
        v.id,
        v.personalNumber,
        v.phoneNumber,
      ]);

      await queryRunner.query(
        `UPDATE "user" AS u SET
           "personalNumber" = v."personalNumber",
           "phoneNumber" = v."phoneNumber"
         FROM (VALUES ${valuesSql}) AS v(id, "personalNumber", "phoneNumber")
         WHERE u.id = v.id`,
        params,
      );

      if (rows.length < CHUNK_SIZE) break;
    }
  }

  private encryptIfNeeded(value: string): string {
    try {
      decryptStrict(value);
      return value; // უკვე დაშიფრულია — ხელუხლებელი დავტოვოთ
    } catch {
      return encryptDeterministic(value);
    }
  }

  public async down(): Promise<void> {
    // შეუქცევადი განზრახ: plaintext-ზე დაბრუნება ისევ ბაზაში PII-ის
    // ჩაწერას ნიშნავს — ეს რეგრესია იქნებოდა, არა rollback. საჭიროების
    // შემთხვევაში აღდგენა ცალკე, გააზრებული backup-იდან უნდა მოხდეს.
  }
}
