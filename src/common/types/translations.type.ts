// მრავალენოვანი (ka/en/ru) კონტენტის საერთო ტიპი — JSONB სვეტებზე
// გამოსაყენებელი (Product/Category/Attribute/Color/AttributeOption).
// Partial-ია, რადგან ყველა ენაზე თარგმანი სავალდებულო არაა (ka
// ყოველთვის უნდა არსებობდეს ბიზნეს-წესით, მაგრამ ტიპის დონეზე ამის
// დაფიქსირება DTO validation-ის საქმეა, არა ამ ტიპისა).
export type Locale = 'ka' | 'en' | 'ru';

export type Translations<T> = Partial<Record<Locale, T>>;
