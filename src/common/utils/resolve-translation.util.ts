import { Locale, Translations } from '../types/translations.type';

const ALL_LOCALES: Locale[] = ['ka', 'en', 'ru'];

// მოცემული `translations` JSONB ობიექტიდან კონკრეტული locale-ის
// მნიშვნელობის ამოღება, fallback-ჯაჭვით: მოთხოვნილი locale → `fallback`
// (default `ka`) → ნებისმიერი სხვა არსებული locale → `undefined`.
// (`undefined` მხოლოდ თეორიულადაა შესაძლებელი — `translations` სულ ცარიელი
// ობიექტი რომ იყოს, რაც ბიზნეს-წესით არ უნდა მოხდეს, მაგრამ ტიპის
// დონეზე ამის გარანტია ვერ ხერხდება, ამიტომ საჭიროებისამებრ callers-მა
// ცალკე უნდა გაუმკლავდნენ ამ შემთხვევას.)
export function resolveTranslation<T>(
  translations: Translations<T> | undefined | null,
  locale: Locale,
  fallback: Locale = 'ka',
): T | undefined {
  if (!translations) {
    return undefined;
  }

  if (translations[locale] !== undefined) {
    return translations[locale];
  }

  if (translations[fallback] !== undefined) {
    return translations[fallback];
  }

  for (const l of ALL_LOCALES) {
    if (translations[l] !== undefined) {
      return translations[l];
    }
  }

  return undefined;
}
