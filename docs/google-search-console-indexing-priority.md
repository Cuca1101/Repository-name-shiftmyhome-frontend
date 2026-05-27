# Google Search Console — URL indexing priority list

Submit these URLs via **URL Inspection → Request indexing** in [Google Search Console](https://search.google.com/search-console), or use the **Sitemaps** report after deploy (sitemap already lists all public routes).

Base URL: `https://www.shiftmyhome.co.uk`

---

## Priority 1 — Local target pages (submit first)

Use after each deploy that changes titles, descriptions, or internal links.

1. https://www.shiftmyhome.co.uk/glasgow-removals
2. https://www.shiftmyhome.co.uk/edinburgh-removals
3. https://www.shiftmyhome.co.uk/man-with-van-glasgow
4. https://www.shiftmyhome.co.uk/furniture-delivery-glasgow
5. https://www.shiftmyhome.co.uk/

---

## Priority 2 — Core conversion & Scotland hubs

6. https://www.shiftmyhome.co.uk/quote
7. https://www.shiftmyhome.co.uk/coverage
8. https://www.shiftmyhome.co.uk/house-removals
9. https://www.shiftmyhome.co.uk/man-with-van
10. https://www.shiftmyhome.co.uk/furniture-delivery
11. https://www.shiftmyhome.co.uk/removals-scotland
12. https://www.shiftmyhome.co.uk/moving-services-scotland
13. https://www.shiftmyhome.co.uk/man-with-van-edinburgh
14. https://www.shiftmyhome.co.uk/furniture-delivery-edinburgh

---

## Priority 3 — Supporting local & intent pages

15. https://www.shiftmyhome.co.uk/aberdeen-removals
16. https://www.shiftmyhome.co.uk/dundee-removals
17. https://www.shiftmyhome.co.uk/office-removals-glasgow
18. https://www.shiftmyhome.co.uk/student-removals-glasgow
19. https://www.shiftmyhome.co.uk/same-day-removals-glasgow
20. https://www.shiftmyhome.co.uk/movers-near-me

---

## Notes

- **Cached snippets** in Google can lag behind live HTML by days or weeks; requesting indexing speeds recrawl but is not instant.
- Resubmit Priority 1 URLs after this SEO deploy (unique meta, internal links, breadcrumb JSON-LD in static HTML).
- Sitemap: https://www.shiftmyhome.co.uk/sitemap.xml (308 URLs, `Allow: /` in robots.txt).
- Homepage canonical is `https://www.shiftmyhome.co.uk/` only on `/`; local pages each have their own canonical (no homepage override).
