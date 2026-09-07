import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from 'crypto';
import { ValueTransformer } from 'typeorm';

// ველების დაშიფვრა at rest (personalNumber, phoneNumber — User entity) — ეს ველები
// აქამდე plaintext ინახებოდა ბაზაში. ENCRYPTION_KEY (32 ბაიტი, hex-ში — ანუ 64
// hex სიმბოლო) სავალდებულოა env-ში; მისი გარეშე აპლიკაცია ვერ ჩაიტვირთება, რომ
// შემთხვევით plaintext-ზე არ "დაბრუნდეს" (fallback-ის გარეშე).
//
// ⚠️ 2026-09-06 უსაფრთხოების ფიქსი: ძველი სქემა დეტერმინისტული AES-256-CBC იყო
// (IV = HMAC-SHA256(key, plaintext)-ის პირველი 16 ბაიტი) — ეს ნიშნავდა, რომ ერთი
// და იგივე plaintext ყოველთვის ერთსა და იმავე ciphertext-ს იძლეოდა (ბაზის
// დამპზე წვდომას მქონე თავდამსხმელს რიგების კორელაციის საშუალებას აძლევდა), და
// CBC-ს არანაირი MAC/AEAD არ გააჩნია (ცვლილება ciphertext-ში decrypt-ზე
// ჩუმად წარმატებულ, თუმცა ნაგავ plaintext-ს იძლეოდა). ახლა ახალი მნიშვნელობები
// AES-256-GCM-ით, შემთხვევითი (non-deterministic) IV-ით და ავთენტიფიცირებული
// (auth tag) ფორმატით იშიფრება (`encrypt`/`GCM_PREFIX`-იანი ფორმატი) — ამიტომ
// ტოლობითი ძებნა (`findByPhoneNumber`) აღარ shdeba თავად ciphertext-ზე, ცალკე
// `hashForSearch()` blind-index-ს იყენებს (HMAC-SHA256 დამოუკიდებელი
// წარმოებული key-თი — `User.phoneNumberHash`). ძველი (ჯერ კიდევ CBC-ით
// დაშიფრული) ჩანაწერების წასაკითხად `decrypt()` ორივე ფორმატს ცნობს — ახალი
// ჩანაწერები/save-ები ყოველთვის ახალი GCM ფორმატით იწერება.
const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

const GCM_ALGORITHM = 'aes-256-gcm';
const GCM_IV_LENGTH = 12;
const GCM_AUTH_TAG_LENGTH = 16;
// ტექსტური პრეფიქსი, რომლითაც ვცნობთ, რომ stored მნიშვნელობა ახალი (GCM)
// ფორმატითაა დაშიფრული და არა ძველი დეტერმინისტული CBC-ით.
const GCM_PREFIX = 'v2:';

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

// blind-index-ის საკვანძო — domain-separated (განსხვავებული label) იმავე
// ENCRYPTION_KEY-დან, `deriveIvKey`-ის მსგავსად, რომ ჰეშირების key AES-ის
// key-ს ან IV-derivation key-ს არასდროს დაემთხვეს.
function deriveSearchKey(key: Buffer): Buffer {
  return createHmac('sha256', key)
    .update('encryption.util:blind-index')
    .digest();
}

// ტოლობითი ძებნისთვის (მაგ. UsersService.findByPhoneNumber) — დეტერმინისტული,
// მაგრამ დამოუკიდებელი key-თი გამომუშავებული ჰეში, არა თავად ciphertext.
// შედეგი არასდროს ინახება/ბრუნდება plaintext-ის ნაცვლად — მხოლოდ
// User.phoneNumberHash-ის მსგავს, ცალკე "search"-სვეტში ტოლობითი WHERE-სთვის.
export function hashForSearch(value: string): string {
  const key = getKey();
  return createHmac('sha256', deriveSearchKey(key)).update(value).digest('hex');
}

// ახალი ფორმატი: AES-256-GCM, შემთხვევითი (non-deterministic) IV + auth tag —
// ერთი და იგივე plaintext ყოველ დაშიფვრაზე სხვადასხვა ciphertext-ს იძლევა და
// ნებისმიერი ciphertext-ის მანიპულაცია decrypt-ზე throw-ს (და არა ჩუმად
// არასწორ plaintext-ს) იწვევს.
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(GCM_IV_LENGTH);
  const cipher = createCipheriv(GCM_ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return (
    GCM_PREFIX + Buffer.concat([iv, authTag, encrypted]).toString('base64')
  );
}

function decryptGcm(stored: string): string {
  const key = getKey();
  const buf = Buffer.from(stored.slice(GCM_PREFIX.length), 'base64');
  const iv = buf.subarray(0, GCM_IV_LENGTH);
  const authTag = buf.subarray(
    GCM_IV_LENGTH,
    GCM_IV_LENGTH + GCM_AUTH_TAG_LENGTH,
  );
  const encrypted = buf.subarray(GCM_IV_LENGTH + GCM_AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(GCM_ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

// ⚠️ LEGACY: ძველი დეტერმინისტული AES-256-CBC ფორმატი — მხოლოდ უკვე
// დაშიფრული ძველი ჩანაწერების წასაკითხად ვინახავთ (იხ. decrypt() ქვემოთ).
// ახალი ჩანაწერები აღარ იწერება ამ ფორმატით — იხ. encrypt() ზემოთ.
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
//
// ⚠️ 2026-09-06: ახლა ჯერ ახალ (GCM, `v2:`-პრეფიქსიანი) ფორმატს ვცდილობთ; თუ
// stored ამ პრეფიქსით არ იწყება, ესეიგი ან ძველი დეტერმინისტული CBC ფორმატია
// (decryptStrict), ან თუნდაც plaintext (ორივე ზემოთ აღწერილი ლმობიერების
// მიზეზების გამო) — ორივე შემთხვევა ისევე უცვლელად ბრუნდება, თუ ვერცერთი
// ფორმატით ვერ გაიშიფრა.
export function decrypt(stored: string): string {
  try {
    if (stored.startsWith(GCM_PREFIX)) {
      return decryptGcm(stored);
    }
    return decryptStrict(stored);
  } catch {
    return stored;
  }
}

// TypeORM column transformer — Entity-ის ველზე `transformer: encryptedColumnTransformer`-ის
// მიბმისას, .save()-ზე ავტომატურად შიფრავს (to, ახალი GCM ფორმატით) — .find*()-ზე
// ავტომატურად გაშიფრავს (from, ორივე ფორმატს ცნობს — იხ. decrypt() ზემოთ).
// ⚠️ phoneNumber-ისთვის: ეს GCM (non-deterministic) ciphertext-ია, ამიტომ WHERE-ით
// ტოლობითი ძებნა (findByPhoneNumber) ამ სვეტზე ვეღარ მუშაობს — მის ნაცვლად
// User.phoneNumberHash (hashForSearch()) გამოიყენება, იხ. users.service.ts.
export const encryptedColumnTransformer: ValueTransformer = {
  to(value?: string | null): string | null | undefined {
    if (value === null || value === undefined || value === '') return value;
    return encrypt(value);
  },
  from(value?: string | null): string | null | undefined {
    if (value === null || value === undefined || value === '') return value;
    return decrypt(value);
  },
};
