/**
 * ერთჯერადი import-სკრიპტი: Valvoline.ge-ს კატეგორიის პროდუქციის გადმოწერა
 * (საჯარო WooCommerce Store API-ს გამოყენებით, ავტორიზაციის გარეშე) და
 * ჩვენს ბექენდში POST /products-ით შეყვანა (admin JWT-ით).
 *
 * გამოყენება:
 *   1. შექმენი scripts/import-valvoline.env ფაილი (იხ. მაგალითი ქვემოთ)
 *   2. გაუშვი ბექენდის root-იდან:
 *        node --env-file=scripts/import-valvoline.env scripts/import-valvoline-products.mjs
 *
 * scripts/import-valvoline.env მაგალითი:
 *   API_URL=http://localhost:5000
 *   ADMIN_EMAIL=admin@example.com
 *   ADMIN_PASSWORD=********
 *   SOURCE_CATEGORY_URL=https://valvoline.ge/product-category/%E1%83%AB%E1%83%A0%E1%83%90%E1%83%95%E1%83%98%E1%83%A1-%E1%83%96%E1%83%94%E1%83%97%E1%83%98/
 *   COMPANY_NAME=Valvoline
 *   CATEGORY_NAME_KA=ძრავის ზეთი
 *   CATEGORY_SLUG=engine-oil
 *   DEFAULT_STOCK=10
 *   DRY_RUN=true            # პირველად აუცილებლად true-თი გაუშვი (არაფერს ჩაწერს, მხოლოდ დაბეჭდავს)
 *
 * შენიშვნა: DRY_RUN=true-ზე სკრიპტი მხოლოდ ბეჭდავს, რას აპირებს გაგზავნას —
 * გადახედე პირველ 3-4 პროდუქტს (ფასი, სახელი, აღწერა) სანამ რეალურად ჩაწერ.
 */

const API_URL = process.env.API_URL || 'http://localhost:5000'; // ბექენდს გლობალური /api პრეფიქსი არ აქვს
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SOURCE_CATEGORY_URL = process.env.SOURCE_CATEGORY_URL;
const COMPANY_NAME = process.env.COMPANY_NAME || 'Valvoline';
const CATEGORY_NAME_KA = process.env.CATEGORY_NAME_KA || 'ძრავის ზეთი';
const CATEGORY_SLUG = process.env.CATEGORY_SLUG || 'engine-oil';
const DEFAULT_STOCK = Number(process.env.DEFAULT_STOCK || 10);
const DRY_RUN = process.env.DRY_RUN !== 'false'; // ნაგულისხმევად DRY_RUN ჩართულია, უსაფრთხოებისთვის
const MAX_PAGES = Number(process.env.MAX_PAGES || 30);

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('შეცდომა: ADMIN_EMAIL / ADMIN_PASSWORD არაა მითითებული (.env ფაილში).');
  process.exit(1);
}
if (!SOURCE_CATEGORY_URL) {
  console.error('შეცდომა: SOURCE_CATEGORY_URL არაა მითითებული.');
  process.exit(1);
}

const sourceOrigin = new URL(SOURCE_CATEGORY_URL).origin;

function decodeEntities(str) {
  if (!str) return str;
  return str
    .replace(/&#8211;/g, '–')
    .replace(/&#8220;/g, '“')
    .replace(/&#8221;/g, '”')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

function stripHtml(html) {
  if (!html) return undefined;

  // Valvoline.ge ტექსტური აღწერის ნაცვლად "Embed Any Document" plugin-ით PDF
  // ტექნიკური მონაცემების ფურცელს ალინკავს (loading-ვიჯეტი, არა რეალური აღწერა).
  // ასეთ შემთხვევაში ტექსტს ვაგდებთ და მხოლოდ PDF-ის ბმულს ვტოვებთ, თუ არსებობს.
  if (html.includes('ead-document') || html.includes('embed_download')) {
    const pdfMatch = html.match(/href="([^"]+\.pdf)"/i);
    return pdfMatch ? `ტექნიკური მონაცემები (PDF): ${pdfMatch[1]}` : undefined;
  }

  const text = html
    .replace(/<\/(p|li|div|br)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .trim();
  return decodeEntities(text) || undefined;
}

// --- 1. Valvoline.ge კატეგორიის გვერდებიდან product-id-ების შეგროვება ---
async function collectProductIds(categoryUrl) {
  const ids = new Set();
  for (let page = 1; page <= MAX_PAGES; page++) {
    const pageUrl = page === 1 ? categoryUrl : new URL(`page/${page}/`, categoryUrl).toString();
    const res = await fetch(pageUrl);
    if (res.status === 404) break; // გვერდები ამოიწურა
    if (!res.ok) {
      console.warn(`გაფრთხილება: ${pageUrl} -> HTTP ${res.status}, ვჩერდები`);
      break;
    }
    const html = await res.text();
    const found = [...html.matchAll(/data-product_id="(\d+)"/g)].map((m) => m[1]);
    if (found.length === 0) break;
    found.forEach((id) => ids.add(id));
    console.log(`გვერდი ${page}: ${found.length} პროდუქტი (სულ ${ids.size})`);
  }
  return [...ids];
}

// --- 2. თითო პროდუქტის დეტალები Store API-დან ---
async function fetchProduct(id) {
  const res = await fetch(`${sourceOrigin}/wp-json/wc/store/products/${id}`);
  if (!res.ok) throw new Error(`product ${id}: HTTP ${res.status}`);
  const p = await res.json();
  return {
    sourceId: p.id,
    name: decodeEntities(p.name),
    description: stripHtml(p.description),
    price: Number(p.prices?.price ?? 0),
    images: (p.images || []).map((img) => img.src).filter(Boolean),
    isInStock: !!p.is_in_stock,
    permalink: p.permalink,
  };
}

// --- 3. ბექენდის auth/company/category ---
async function login() {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  if (!res.ok) throw new Error(`login failed: HTTP ${res.status} ${await res.text()}`);
  const data = await res.json();
  const token = data.access_token || data.accessToken;
  if (!token) throw new Error(`login response-ში access token ვერ ვიპოვე: ${JSON.stringify(data)}`);
  return token;
}

async function ensureCompany(token) {
  const listRes = await fetch(`${API_URL}/companies?limit=200`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (listRes.ok) {
    const list = await listRes.json();
    const items = Array.isArray(list) ? list : list.items || list.data || [];
    const existing = items.find(
      (c) => (c.name || '').trim().toLowerCase() === COMPANY_NAME.trim().toLowerCase(),
    );
    if (existing) {
      console.log(`Company "${COMPANY_NAME}" უკვე არსებობს (id=${existing.id})`);
      return existing.id;
    }
  }
  if (DRY_RUN) {
    console.log(`[DRY_RUN] შეიქმნებოდა Company: ${COMPANY_NAME}`);
    return 'DRY_RUN_COMPANY_ID';
  }
  const res = await fetch(`${API_URL}/companies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: COMPANY_NAME }),
  });
  if (!res.ok) throw new Error(`company create failed: HTTP ${res.status} ${await res.text()}`);
  const created = await res.json();
  console.log(`Company შეიქმნა: ${COMPANY_NAME} (id=${created.id})`);
  return created.id;
}

async function ensureCategory(token) {
  const listRes = await fetch(`${API_URL}/categories?limit=100`);
  if (listRes.ok) {
    const list = await listRes.json();
    const items = Array.isArray(list) ? list : list.items || list.data || [];
    const existing = items.find((c) => c.slug === CATEGORY_SLUG);
    if (existing) {
      console.log(`Category "${CATEGORY_SLUG}" უკვე არსებობს (id=${existing.id})`);
      return existing.id;
    }
  }
  if (DRY_RUN) {
    console.log(`[DRY_RUN] შეიქმნებოდა Category: ${CATEGORY_NAME_KA} (slug=${CATEGORY_SLUG})`);
    return 'DRY_RUN_CATEGORY_ID';
  }
  const res = await fetch(`${API_URL}/categories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      translations: { ka: { name: CATEGORY_NAME_KA } },
      slug: CATEGORY_SLUG,
    }),
  });
  if (!res.ok) throw new Error(`category create failed: HTTP ${res.status} ${await res.text()}`);
  const created = await res.json();
  console.log(`Category შეიქმნა: ${CATEGORY_NAME_KA} (id=${created.id})`);
  return created.id;
}

async function createProduct(token, companyId, categoryId, item) {
  const body = {
    translations: {
      ka: {
        name: item.name,
        ...(item.description ? { description: item.description } : {}),
      },
    },
    price: item.price,
    stock: item.isInStock ? DEFAULT_STOCK : 0,
    images: item.images,
    companyId,
    ...(categoryId ? { categoryId } : {}),
  };

  if (DRY_RUN) {
    console.log(`[DRY_RUN] POST /products <-`, JSON.stringify(body, null, 2));
    return;
  }

  const res = await fetch(`${API_URL}/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`product create failed (source #${item.sourceId}): HTTP ${res.status} ${await res.text()}`);
  }
  const created = await res.json();
  console.log(`✓ პროდუქტი შეიქმნა: "${item.name}" (id=${created.id}, source #${item.sourceId})`);
}

async function main() {
  console.log(`DRY_RUN=${DRY_RUN} ${DRY_RUN ? '(არაფერი ჩაიწერება ბაზაში — მხოლოდ პრევიუ)' : '(!!! რეალურად ჩაიწერება ბაზაში !!!)'}`);

  console.log('\n== 1. პროდუქტების სია Valvoline.ge-დან ==');
  const ids = await collectProductIds(SOURCE_CATEGORY_URL);
  console.log(`სულ ნაპოვნია ${ids.length} უნიკალური პროდუქტი`);

  console.log('\n== 2. ავტორიზაცია ბექენდზე ==');
  const token = await login();
  console.log('✓ დალოგინდა');

  console.log('\n== 3. Company / Category ==');
  const companyId = await ensureCompany(token);
  const categoryId = await ensureCategory(token);

  console.log('\n== 4. პროდუქტების იმპორტი ==');
  let ok = 0;
  let failed = 0;
  for (const id of ids) {
    try {
      const item = await fetchProduct(id);
      await createProduct(token, companyId, categoryId, item);
      ok++;
    } catch (err) {
      failed++;
      console.error(`✗ პროდუქტი #${id} ჩავარდა: ${err.message}`);
    }
  }

  console.log(`\n== დასრულდა == წარმატებული: ${ok}, ჩავარდნილი: ${failed}, სულ: ${ids.length}`);
  if (DRY_RUN) {
    console.log('\nეს იყო DRY_RUN. რეალურად ჩასაწერად გაუშვი DRY_RUN=false-ით.');
  }
}

main().catch((err) => {
  console.error('\nსკრიპტი ჩავარდა:', err);
  process.exit(1);
});
