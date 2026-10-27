import { MigrationInterface, QueryRunner } from 'typeorm';
import { decrypt, hashForSearch } from '../common/utils/encryption.util';
import { normalizePhoneForCompare } from '../common/utils/phone.util';

// User.phoneNumberHash აქამდე ნედლი (ნორმალიზაციის გარეშე) ნომრის HMAC იყო —
// `599123456` და `+995599123456` სხვადასხვა ჰეშს იძლეოდა, ანუ unique-შეზღუდვა
// ერთი ნომრის სხვა ფორმატით ხელახლა რეგისტრაციას ვერ აჩერებდა. ახლა ჰეში
// ნორმალიზებულ ნომერზეა (hashPhoneForSearch) — ეს მიგრაცია არსებულ ჩანაწერებს
// ხელახლა ითვლის.
//
// დუბლიკატები: თუ ორ მომხმარებელს ერთი და იგივე ნომერი სხვადასხვა ფორმატით
// აქვს, ორივეს ერთი ჰეში unique-ს დაარღვევდა და (production-ში migrationsRun
// ბუთზე ეშვება) აპლიკაცია ვეღარ ჩაირთვებოდა. ამიტომ ჰეშს იღებს პირველი
// (ის, ვისაც უკვე ნორმალიზებული ფორმით აქვს, შემდეგ — უმცირესი id), დანარჩენებს
// ძველი ჰეში რჩებათ და console-ში ვაფიქსირებთ ხელით გადასახედად.
//
// batching/keyset — იგივე პატერნი, რაც 1787970000000-EncryptUserPii-ში.
const CHUNK_SIZE = 500;

interface PhoneRow {
  id: number;
  phoneNumber: string;
  phoneNumberHash: string | null;
}

export class NormalizePhoneNumberHash1788140000000 implements MigrationInterface {
  name = 'NormalizePhoneNumberHash1788140000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const skipped: number[] = [];

    await this.forEachChunk(queryRunner, async (rows) => {
      const updates: { id: number; hash: string }[] = [];
      const claimedInChunk = new Set<string>();

      for (const row of rows) {
        const phone = this.decryptPhone(row.phoneNumber);
        const normalized = phone ? normalizePhoneForCompare(phone) : '';
        if (!normalized) {
          skipped.push(row.id);
          continue;
        }
        const hash = hashForSearch(normalized);
        if (hash === row.phoneNumberHash) continue; // უკვე ნორმალიზებულია
        if (claimedInChunk.has(hash)) {
          skipped.push(row.id);
          continue;
        }
        claimedInChunk.add(hash);
        updates.push({ id: row.id, hash });
      }
      if (!updates.length) return;

      // NOT EXISTS — ჰეში უკვე სხვას აქვს (ნორმალიზებული ფორმით შენახული ან
      // წინა chunk-ში მინიჭებული) → ამ row-ს ვტოვებთ.
      const applied = (await queryRunner.query(
        `UPDATE "user" AS u SET "phoneNumberHash" = v.hash
         FROM (VALUES ${this.valuesSql(updates.length)}) AS v(id, hash)
         WHERE u.id = v.id
           AND NOT EXISTS (
             SELECT 1 FROM "user" o
             WHERE o."phoneNumberHash" = v.hash AND o.id <> v.id
           )
         RETURNING u.id`,
        updates.flatMap((u) => [u.id, u.hash]),
      )) as [{ id: number }[], number] | { id: number }[];
      const appliedRows = Array.isArray(applied[0])
        ? (applied[0] as { id: number }[])
        : (applied as { id: number }[]);
      const appliedIds = new Set(appliedRows.map((r) => r.id));
      for (const u of updates) {
        if (!appliedIds.has(u.id)) skipped.push(u.id);
      }
    });

    if (skipped.length) {
      console.warn(
        `NormalizePhoneNumberHash: ${skipped.length} მომხმარებლის ნომერი სხვის ნომერს ემთხვევა ან ვერ გაიშიფრა — ჰეში უცვლელია, საჭიროა ხელით გადახედვა. user id-ები: ${skipped.join(', ')}`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ძველი ფორმა — ნედლი (ნორმალიზაციის გარეშე) ნომრის HMAC.
    await this.forEachChunk(queryRunner, async (rows) => {
      const updates = rows
        .map((row) => ({
          id: row.id,
          phone: this.decryptPhone(row.phoneNumber),
        }))
        .filter((r): r is { id: number; phone: string } => !!r.phone)
        .map((r) => ({ id: r.id, hash: hashForSearch(r.phone) }));
      if (!updates.length) return;

      await queryRunner.query(
        `UPDATE "user" AS u SET "phoneNumberHash" = v.hash
         FROM (VALUES ${this.valuesSql(updates.length)}) AS v(id, hash)
         WHERE u.id = v.id`,
        updates.flatMap((u) => [u.id, u.hash]),
      );
    });
  }

  private async forEachChunk(
    queryRunner: QueryRunner,
    handle: (rows: PhoneRow[]) => Promise<void>,
  ): Promise<void> {
    let lastId = 0;
    for (;;) {
      const rows = (await queryRunner.query(
        `SELECT "id", "phoneNumber", "phoneNumberHash" FROM "user"
           WHERE "id" > $1 AND "phoneNumber" IS NOT NULL AND "phoneNumber" <> ''
           ORDER BY "id"
           LIMIT ${CHUNK_SIZE}`,
        [lastId],
      )) as PhoneRow[];

      if (rows.length === 0) break;
      lastId = rows[rows.length - 1].id;
      await handle(rows);
      if (rows.length < CHUNK_SIZE) break;
    }
  }

  // decrypt() ლმობიერია — ვერ გაშიფრულ მნიშვნელობას უცვლელად აბრუნებს. GCM
  // (`v2:`) ciphertext-ის უცვლელად დაბრუნება ნიშნავს, რომ გაშიფვრა ჩავარდა
  // (მაგ. სხვა ENCRYPTION_KEY) — ასეთ row-ს არ ვეხებით.
  private decryptPhone(stored: string): string | null {
    const plain = decrypt(stored);
    if (plain === stored && stored.startsWith('v2:')) return null;
    return plain;
  }

  private valuesSql(count: number): string {
    return Array.from(
      { length: count },
      (_, i) => `($${i * 2 + 1}::int, $${i * 2 + 2}::varchar)`,
    ).join(', ');
  }
}
