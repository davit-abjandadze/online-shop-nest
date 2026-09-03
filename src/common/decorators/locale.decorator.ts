import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Locale as LocaleType } from '../types/translations.type';

const SUPPORTED_LOCALES: LocaleType[] = ['ka', 'en', 'ru'];
const DEFAULT_LOCALE: LocaleType = 'ka';

// `Accept-Language` header-იდან locale-ის ამოღება storefront endpoint-ებისთვის
// (translations JSONB-ის resolveTranslation-თან ერთად გამოსაყენებელი).
// Header-ი შეიძლება იყოს რთული ("en-US,en;q=0.9,ka;q=0.8") — ვიღებთ მხოლოდ
// პირველ (უპირატეს) language subtag-ს, primary tag-ს (`-`-მდე ნაწილს),
// lowercase-ში ვამოწმებთ ka/en/ru-სთან. თუ header არ არსებობს ან უცნობია —
// default 'ka'.
export const Locale = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): LocaleType => {
    const request = ctx.switchToHttp().getRequest();
    const header: string | undefined = request.headers?.['accept-language'];
    if (!header) {
      return DEFAULT_LOCALE;
    }

    const primaryTag = header.split(',')[0]?.split(';')[0]?.split('-')[0];
    const normalized = primaryTag?.trim().toLowerCase();

    return SUPPORTED_LOCALES.includes(normalized as LocaleType)
      ? (normalized as LocaleType)
      : DEFAULT_LOCALE;
  },
);
