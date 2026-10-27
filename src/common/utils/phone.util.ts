import { hashForSearch } from './encryption.util';

// მობილურის ნომრის შედარებისთვის — frontend-მა ერთი და იგივე ნომერი შეიძლება
// სხვადასხვა ფორმით გამოგზავნოს (`+995 599 12-34-56`, `995599123456`,
// `599123456`). ვტოვებთ მხოლოდ ციფრებს და ქვეყნის კოდს (995) ვაშორებთ.
// გამოიყენება შედარებისთვის (OTP-ის ნომერზე მიბმა) და blind-index-ისთვის
// (hashPhoneForSearch) — ბაზაში ჩაწერილ (დაშიფრულ) მნიშვნელობას არ ცვლის.
export function normalizePhoneForCompare(phone: string): string {
  return phone.replace(/\D/g, '').replace(/^995/, '');
}

// User.phoneNumberHash — ნორმალიზებული ნომრის HMAC. აქამდე ნედლი მნიშვნელობა
// ჰეშირდებოდა, ანუ `599123456` და `+995599123456` სხვადასხვა ჰეშს იძლეოდა და
// ერთი ნომრით ორი ანგარიში იქმნებოდა unique-შეზღუდვის გვერდის ავლით
// (იხ. 1788140000000-NormalizePhoneNumberHash).
export function hashPhoneForSearch(phone: string): string {
  return hashForSearch(normalizePhoneForCompare(phone));
}

// SMS-ის გაგზავნამდე ვალიდაცია: მხოლოდ ქართული მობილური (5XXXXXXXX),
// სურვილისამებრ +995/995 პრეფიქსით. ამის გარეშე public /otp/send-ით
// ნებისმიერ (მაგ. ძვირად ტარიფირებულ საერთაშორისო) ნომერზე შეიძლებოდა
// ფასიანი SMS-ების გაგზავნა (SMS pumping / toll fraud).
export const GEORGIAN_MOBILE_REGEX = /^(\+?995)?5\d{8}$/;

// გამყოფი სიმბოლოების (space, -, (, )) მოშორება — ValidationPipe-ის
// transform-ში, რომ `+995 599 12-34-56` ფორმატიც გაიაროს regex-ზე.
export function stripPhoneSeparators(value: unknown): unknown {
  return typeof value === 'string' ? value.replace(/[\s\-()]/g, '') : value;
}
