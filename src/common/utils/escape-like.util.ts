// ILIKE/LIKE-ის სპეცსიმბოლოების escape — თორემ `%`/`_` მომხმარებლის ტექსტში
// wildcard-ად მუშაობს (მაგ. `search=%%%%` ყველაფერს ემთხვევა). Postgres-ში
// LIKE-ის default escape სიმბოლო `\`-ია, ამიტომ ESCAPE-ის მითითება არ სჭირდება.
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}
