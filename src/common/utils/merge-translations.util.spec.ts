import { mergeTranslations } from './merge-translations.util';

type Entry = { name: string; description?: string };

describe('mergeTranslations', () => {
  const existing = {
    ka: { name: 'სახელი', description: 'აღწერა' },
    en: { name: 'Name' },
    ru: { name: 'Имя' },
  };

  it('გაუთითებელ locale-ებს უცვლელად ტოვებს და მითითებულს merge-ავს', () => {
    expect(
      mergeTranslations<Entry>(existing, { en: { name: 'New name' } }),
    ).toEqual({ ...existing, en: { name: 'New name' } });
  });

  it('ცარიელი description-ით აღწერას შლის (გადაეწერება "")', () => {
    expect(
      mergeTranslations<Entry>(existing, {
        ka: { name: 'სახელი', description: '' },
      })?.ka,
    ).toEqual({ name: 'სახელი', description: '' });
  });

  it('en/ru-ზე null ამ ენის თარგმანს მთლიანად შლის', () => {
    expect(mergeTranslations<Entry>(existing, { en: null, ru: null })).toEqual({
      ka: existing.ka,
    });
  });

  it('ka-ზე null-ს იგნორს უკეთებს — ძირითადი ენა ვერ წაიშლება', () => {
    expect(mergeTranslations<Entry>(existing, { ka: null })).toEqual(existing);
  });
});
