import { createCipheriv, createDecipheriv, createHmac } from 'crypto';
import { ValueTransformer } from 'typeorm';

// ველების დაშიფვრა at rest (personalNumber, phoneNumber — User entity) — ეს ველები
// აქამდე plaintext ინახებოდა ბაზაში. ENCRYPTION_KEY (32 ბაიტი, hex-ში — ანუ 64
// hex სიმბოლო) სავალდებულოა env-ში; მისი გარეშე აპლიკაცია ვერ ჩაიტვირთება, რომ
// შემთხვევით plaintext-ზე არ "დაბრუნდეს" (fallback-ის გარეშე).
//
// დეტერმინისტული AES-256-CBC (IV = HMAC-SHA256(key, plaintext)-ის პირველი 16 ბაიტი) —
// განზრახ არა შემთხვევითი IV: phoneNumber-ს აქვს unique-შეზღუდვა და ორივე ველზე
// ხდება ტოლობით ძებნა (findByPhoneNumber, findByEmail-ის მსგავსად), რაც non-deterministic
// (random-IV) დაშიფვრით შეუძლებელი იქნებოდა — ბაზაში ყოველი ჩანაწერი სხვანაირად
// დაშიფრულიყო და WHERE-ით ვეღარ ვიპოვიდით. კომპრომისი: ერთი და იგივე plaintext
// ყოველთვის ერთსა და იმავე ciphertext-ს იძლევა (ნაწილობრივ სუსტდება სემანტიკური
// უსაფრთხოება — statistical/frequency ანალიზი თეორიულად შესაძლებელია), მაგრამ
// plaintext ბაზის დამპში/ლოგში აღარ ჩანს, რაც აქ მთავარი მიზანია.
const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw || raw.length !== 64) {
    throw new Error(
      'ENCRYPTION_KEY გარემოს ცვლადი აუცილებელია და უნდა შეიცავდეს ზუსტად 64 hex სიმბოლოს (32 ბაიტი) — ' +
        'PII ველების (User.personalNumber/phoneNumber) დაშიფვრისთვის. გენერაცია: `openssl rand -hex 32`.',
    );
  }
  return Buffer.from(raw, 'hex');
}

// IV-ის HMAC-ს ცალკე, დამოუკიდებელი key-თი ვთვლით (და არა უშუალოდ AES-ის
// საკვანძოთი) — თუმცა ორივე საბოლოოდ ერთი და იმავე ENCRYPTION_KEY-დანაა
// წარმოებული, HKDF-ის მსგავსი domain-separation (HMAC(key, "iv") ლეიბლით)
// გამორიცხავს related-key ურთიერთქმედებას AES-ის საკვანძოსა და HMAC-ის
// საკვანძოს შორის, რაც იქნებოდა, ერთი და იგივე ბაიტები ორივე პრიმიტივს
// პირდაპირ რომ გადაცემოდა.
function deriveIvKey(key: Buffer): Buffer {
  return createHmac('sha256', key)
    .update('encryption.util:iv-derivation')
    .digest();
}

function deterministicIv(key: Buffer, plaintext: string): Buffer {
  return createHmac('sha256', deriveIvKey(key))
    .update(plaintext)
    .digest()
    .subarray(0, IV_LENGTH);
}

export function encryptDeterministic(plaintext: string): string {
  const key = getKey();
  const iv = deterministicIv(key, plaintext);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  // IV-ს ცალკე არ ვინახავთ — decrypt-ისას საკმარისია ciphertext + key (CBC-ს სჭირდება
  // IV, ამიტომ მას ciphertext-ის წინ ვურთავთ; შედეგი მაინც დეტერმინისტულია, რადგან
  // IV თავად plaintext-იდანაა გამომუშავებული).
  return Buffer.concat([iv, encrypted]).toString('base64');
}

// მკაცრი ვერსია — ნამდვილად ჩავარდება (throw), თუ `stored` ჩვენი ფორმატის
// ciphertext არ არის. EncryptUserPii მიგრაცია ამას იყენებს plaintext-ისა და
// უკვე-დაშიფრული მნიშვნელობის გასარჩევად (decrypt()-ისგან განსხვავებით, ქვემოთ).
export function decryptStrict(stored: string): string {
  const key = getKey();
  const buf = Buffer.from(stored, 'base64');
  if (buf.length <= IV_LENGTH) {
    throw new Error('ciphertext too short — not our format');
  }
  const iv = buf.subarray(0, IV_LENGTH);
  const encrypted = buf.subarray(IV_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

// ⚠️ 2026-09-04: EncryptUserPii მიგრაცია (backfill) production-ში ავტომატურად
// გაეშვება (migrationsRun: NODE_ENV === 'production', იხ. app.module.ts), მაგრამ
// dev-ში/ლოკალურად NODE_ENV !== 'production'-ის გამო ავტომატურად არ სრულდება —
// მანამ, სანამ ვინმე ხელით არ გაუშვებს `yarn migration:run`-ს, ბაზაში ძველი
// (მიგრაციამდელი) ჩანაწერების personalNumber/phoneNumber კვლავ plaintext-ია.
// ასეთ მნიშვნელობაზე decryptStrict() (bad IV/padding) ჩავარდებოდა ჩვეულებრივ
// login/find-ზეც კი. ამიტომ decryptStrict-ის ჩავარდნისას (ანუ მონაცემი ჯერ არ
// არის დაშიფრული ამ ფორმატში) plaintext მნიშვნელობას უცვლელად ვაბრუნებთ — ეს
// dev/staging-ს იცავს იმ crash-ისგან, სანამ ვინმე ხელით არ გაუშვებს მიგრაციას;
// მომდევნო .save()-ზე encryptedColumnTransformer.to() ისედაც დაშიფრავს მას.
export function decrypt(stored: string): string {
  try {
    return decryptStrict(stored);
  } catch {
    return stored;
  }
}

// TypeORM column transformer — Entity-ის ველზე `transformer: encryptedColumnTransformer`-ის
// მიბმისას, .save()-ზე ავტომატურად შიფრავს (to), .find*()-ზე ავტომატურად
// გაშიფრავს (from) — დანარჩენი კოდი (მაგ. mask.util.ts-ის masking, findByPhoneNumber-ის
// WHERE-ით ძებნა) plaintext-თან/plaintext-ის დაშიფრულ ვარიანტთან ისევე მუშაობს,
// როგორც აქამდე, ცვლილების გარეშე.
export const encryptedColumnTransformer: ValueTransformer = {
  to(value?: string | null): string | null | undefined {
    if (value === null || value === undefined || value === '') return value;
    return encryptDeterministic(value);
  },
  from(value?: string | null): string | null | undefined {
    if (value === null || value === undefined || value === '') return value;
    return decrypt(value);
  },
};
