import { defaults, types } from 'pg';

// Postgres-ის სესიის timezone UTC-ია, ამიტომ `timestamp without time zone`
// სვეტებში (CreateDateColumn/UpdateDateColumn-ის `now()` default-ით) UTC-ის
// wall-clock დრო ინახება. node-postgres კი ასეთ მნიშვნელობას default-ად
// სერვერის *ლოკალურ* დროდ კითხულობს (და Date-ს ლოკალური offset-ით წერს) —
// GMT+4 მანქანაზე ეს ყველა createdAt-ს 4 საათით წარსულში აჩენდა
// (მაგ. შეკვეთა 00:04-ზე გაფორმდა, API კი 16:04Z-ს აბრუნებდა). stats.service.ts
// ამ სვეტებს უკვე UTC-ად განიხილავს (`AT TIME ZONE 'UTC'`), ამიტომ დრაივერსაც
// ორივე მიმართულებით UTC-ზე ვაყენებთ — სერვერის TZ-ისგან დამოუკიდებლად.
const TIMESTAMP_WITHOUT_TZ_OID = 1114;

types.setTypeParser(TIMESTAMP_WITHOUT_TZ_OID, (value: string) =>
  value === null ? null : new Date(value.replace(' ', 'T') + 'Z'),
);
defaults.parseInputDatesAsUTC = true;
