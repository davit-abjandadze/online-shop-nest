import { Matches, ValidationOptions } from 'class-validator';

/**
 * storefront-ზე <a href>-ად დარენდერებული ადმინის ლინკები (hero slide-ის
 * ღილაკი, product slider-ის "ყველას ნახვა") — მხოლოდ http(s):// ან საიტის
 * შიდა ფარდობითი მისამართი (`/...`). ამის გარეშე `javascript:...` ლინკი
 * დაწკაპუნებისას მყიდველის ბრაუზერში სკრიპტს გაუშვებდა (stored XSS).
 * `//evil.com` (protocol-relative) განზრახ არ დაიშვება.
 */
export function IsSafeLink(validationOptions?: ValidationOptions) {
  return Matches(/^(https?:\/\/|\/(?!\/))/i, {
    message: 'ლინკი უნდა იწყებოდეს http://, https:// ან / სიმბოლოთი',
    ...validationOptions,
  });
}
