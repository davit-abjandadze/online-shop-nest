import { Translations } from '../types/translations.type';

// PATCH-ტიპის update()-ებზე translations JSONB სვეტის წერამდე
// გამოსაყენებელი per-locale deep-merge. თუ პირდაპირ
// `Object.assign(entity, { translations: dto.translations })`-ს გავაკეთებთ,
// ადმინის მიერ მხოლოდ ერთი locale-ის გაგზავნა (მაგ. `{ en: {...} }`
// "English tab"-ის რედაქტირებისას) მთლიანად ჩაანაცვლებს არსებულ
// translations ობიექტს და დანარჩენი locale-ების (ka/ru) მონაცემები
// წაიშლება. ამის ნაცვლად თითოეული locale ცალ-ცალკე merge-ვდება
// არსებულთან — ახალი locale-ის ველები ემატება/თავზე გადაეწერება
// არსებულს, ხოლო გაუთითებელი locale-ები უცვლელი რჩება.
export function mergeTranslations<T extends object>(
  existing: Translations<T> | undefined | null,
  incoming: Translations<T> | undefined,
): Translations<T> | undefined {
  if (!incoming) {
    return existing ?? undefined;
  }

  const result: Translations<T> = { ...(existing ?? {}) };

  for (const locale of Object.keys(incoming) as (keyof Translations<T>)[]) {
    const incomingEntry = incoming[locale];
    if (incomingEntry === undefined) {
      continue;
    }
    result[locale] = {
      ...(result[locale] ?? {}),
      ...incomingEntry,
    };
  }

  return result;
}
