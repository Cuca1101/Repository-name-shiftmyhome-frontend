# Indexare Google — toate paginile (306 URL-uri)

Google **nu permite** indexarea forțată din exterior fără contul tău Search Console. Site-ul e deja pregătit tehnic; pașii de mai jos îi pui pe tine în GSC (5–10 minute, o singură dată).

## Ce e deja făcut pe site

| Element | Status |
|---------|--------|
| `robots.txt` | `Allow: /`, `Sitemap: https://www.shiftmyhome.co.uk/sitemap.xml` |
| `sitemap.xml` | **306** URL-uri publice (generat la fiecare `npm run build`) |
| HTML pentru crawlere | Titluri, meta, canonical, JSON-LD pe fiecare rută (prerender) |
| `/admin` | Blocat în robots (`Disallow: /admin`) |

## Pasul 1 — Trimite sitemap-ul (acoperă TOATE paginile)

1. Deschide [Google Search Console](https://search.google.com/search-console)
2. Proprietate: **https://www.shiftmyhome.co.uk** (varianta cu `www`, aceeași ca în sitemap)
3. Meniu stânga: **Sitemaps** / **Sitemap-uri**
4. La „Add a new sitemap” introdu: `sitemap.xml`
5. **Submit**

Google descoperă și pune în coadă de crawl **toate** URL-urile din sitemap. Nu trebuie să trimiți manual fiecare din cele 306 pagini.

Dacă sitemap-ul era deja trimis: apasă pe el → verifică „Last read” după 1–3 zile; la deploy SEO nou poți **Resubmit** același `sitemap.xml`.

## Pasul 2 — Verificare proprietate (dacă nu e deja)

- Preferă prefixul URL **https://www.shiftmyhome.co.uk/** (nu doar `shiftmyhome.co.uk` fără www), ca să se potrivească cu canonical-urile din sitemap.

## „Test live URL” vs „Page is not indexed”

| Instrument GSC | Ce face |
|----------------|---------|
| **Test live URL** | Google **fetch-uiește acum** pagina și îți arată HTML-ul curent (diagnostic). |
| **Page indexing** (raportul principal) | Arată dacă URL-ul e în **indexul de căutare**. |

E **normal** ca Test live să arate conținut bun, iar raportul să rămână *Discovered – currently not indexed* sau *URL is not on Google* încă **zile/săptămâni**. Test live **nu indexează** automat pagina.

**Ce ajută:**

1. După Test live → apasă **Request indexing** (nu doar Test).
2. În URL Inspection folosește URL-ul **cu slash final**, ca în sitemap: `https://www.shiftmyhome.co.uk/glasgow-removals/` (fără slash → redirect 308 și câmpuri N/A la crawl).
3. Resubmit `sitemap.xml` după deploy-uri SEO.

## Pasul 3 — Prioritate manuală (opțional, ~20 URL-uri)

API-ul Google limitează „Request indexing” la ~**200 URL-uri/zi**; pentru 306 pagini sitemap-ul e metoda corectă.

Pentru pagini importante (conversie + orașe mari), folosește **URL Inspection** → **Request indexing** pe lista din `google-search-console-indexing-priority.md`.

## Listă completă URL-uri (export)

```bash
node scripts/export-sitemap-urls.mjs
```

Generează:

- `docs/gsc-all-urls.txt` — câte un URL pe linie
- `docs/gsc-all-urls.csv` — pentru import / referință

## Cât durează indexarea?

| Așteptare | Realitate |
|-----------|-----------|
| Instant | Nu — Google indexează în zile/săptămâni |
| După sitemap submit | Crawl în coadă; multe pagini apar în 1–4 săptămâni |
| Pagini noi / actualizate | „Request indexing” accelerează recrawl-ul, nu garantează poziția |

Verifică în GSC: **Pages** / **Pagini** → „Indexed” vs „Not indexed” și motivele (ex. „Crawled – currently not indexed”).

## Ce NU putem face din cod

- **Indexing API** Google — doar pentru job postings, evenimente live etc., nu pentru site-uri de removals.
- Indexare fără **login GSC** al proprietarului site-ului.

Dacă vrei automatizare API (service account în GSC + script), spune și configurăm separat; tot ai nevoie de acces la contul Search Console.
