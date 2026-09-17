import sanitizeHtml from 'sanitize-html';

// ადმინის rich-text ედიტორის (TipTap/Quill) output-ს ვასუფთავებთ შენახვის წინ —
// allow-list მიდგომა: მხოლოდ ტექსტის ფორმატირებისთვის/ლინკებისთვის/სურათებისთვის
// საჭირო ტეგები/ატრიბუტები დაშვებულია, ყველაფერი დანარჩენი (მათ შორის
// <script>/<style>/event handler-ატრიბუტები) იჭრება — XSS-ის პრევენცია
// admin-ის შეყვანილ content-ში, რასაც user-ები საკუთარ browser-ში ხედავენ.
const ALLOWED_TAGS = [
  'p',
  'br',
  'b',
  'strong',
  'i',
  'em',
  'u',
  's',
  'ul',
  'ol',
  'li',
  'h1',
  'h2',
  'h3',
  'blockquote',
  'a',
  'img',
];

const ALLOWED_ATTRIBUTES: sanitizeHtml.IOptions['allowedAttributes'] = {
  a: ['href', 'target', 'rel'],
  img: ['src', 'alt', 'width', 'height'],
};

export function sanitizeNotificationHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    // ლინკებში (a href) მხოლოდ http(s) — javascript:/data: დაბლოკილია.
    allowedSchemes: ['http', 'https'],
    // data: მხოლოდ img[src]-ისთვისაა საჭირო (base64 სურათები), ამიტომ
    // scheme-override მხოლოდ img ტეგზეა, არა გლობალურად (a href-ზეც არ ვრცელდება).
    allowedSchemesByTag: {
      img: ['http', 'https', 'data'],
    },
    // გარე ლინკები ყოველთვის rel="noopener noreferrer"-ით, tabnabbing-ის საწინააღმდეგოდ
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', {
        rel: 'noopener noreferrer',
      }),
    },
  });
}
