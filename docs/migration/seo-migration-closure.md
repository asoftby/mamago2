# SEO MIGRATION CLOSURE

Status: **MANDATORY LAUNCH GATE — NOT STARTED / NOT COMPLETE**.

Production launch is prohibited until this phase has a documented founder
SEO Go/No-Go. All runtime assertions must be repeated on the integrated RC
with production-host configuration.

## 1. Immutable baseline

- Export Google Search Console Pages/Indexing, landing pages, queries, clicks,
  impressions, CTR, average position, sitemap, Core Web Vitals, manual actions,
  security issues and crawl data.
- Export analytics organic landing pages, sessions/users, conversions, device
  and city distribution.
- Build the legacy URL inventory from WordPress DB, sitemap, redirects, Search
  Console, analytics and available backlinks. Classify P0 traffic/conversion/
  backlink URLs, P1 useful indexed URLs and P2 archive/low-value URLs.
- Freeze immutable artifacts for status, title, description, H1, canonical,
  robots, structured data, old 404/5xx and redirect chains.

## 2. Legacy URL → new URL map

Every known URL receives exactly one disposition: `KEEP_200`, `REDIRECT_301`,
`GONE_410`, `REAL_404`, `BLOCKED_NOINDEX` or `MANUAL_DECISION`.

Required coverage: Articles, Events, Routes, Places, Offers/services/programs,
categories/taxonomies, static pages and significant media. The deterministic
manifest has a checksum and collision audit. It must cover 100% of P0 and all
known indexable legacy URLs.

Invariants: each 301 goes directly to a final canonical indexable 200; P0
chains = 0; loops = 0; irrelevant redirects to `/` = 0; destinations are not
3xx/4xx/5xx/noindex and do not canonicalize to an unrelated page. WordPress
catch-all must not mask real 404s. Slash/query/http/https/www normalization
must be explicitly approved.

```text
legacy URL -> one 301 -> final canonical page -> HTTP 200
```

## 3. Canonical and indexability parity

On integrated RC, inspect server-rendered HTML for homepage, city homepage,
Articles, Events, Routes, Places, Offers, categories and static pages:
exactly one absolute production-host, slug-based, correctly city-scoped
canonical; canonical destination is 200, indexable and not a redirect.
Cross-entity canonicals are forbidden. Private/admin/business and
DRAFT/PENDING/blocked entities are excluded; pagination/filter/search pages
have an explicit policy.

Current local status: Place and Route canonical `RESOLVED LOCAL`; Offer
canonical `PASS LOCAL`; Article/Event require integrated-RC revalidation.

## 4. Content and metadata parity

For 100% P0 pages, top traffic/backlink pages and a representative sample of
each entity/city/media state, preserve search intent and important content.
Verify title, description, one H1, body, addresses, dates, prices, contacts,
meaningful alt/captions, Open Graph and fallback image. Broken images, empty
metadata, mojibake, lost WordPress content, misleading date freshness and
mass duplicate titles/descriptions are not allowed.

## 5. City architecture and duplicate control

One entity has one indexable URL. Default-city and non-city paths do not
compete; wrong-city paths do not return indexable 200; filters and the city
switcher do not create crawl traps. Mogilev blocked Route and CITY_BLOCKED
Places remain absent from sitemap/discovery. Do not emit hreflang without a
real translated version.

## 6. Sitemap, robots and noindex

Sitemap contains only unique canonical indexable 200 slug URLs, with meaningful
`lastmod`; DRAFT/PENDING/private/blocked, redirect, 404/5xx and ID URLs are
absent. Validate sitemap index and robots.txt. Local/dev/staging, admin,
business, auth, API and internal search stay blocked while CSS/JS remain
crawlable. Global noindex remains until Go/No-Go; removing it is an exact
cutover action followed by repeated HTML/header checks.

## 7. Structured data

Validate Article, Event, Place/LocalBusiness, eligible Offer/Service/Product,
BreadcrumbList and Organization/WebSite JSON-LD. URLs equal canonical and
visible data equals structured data. Fake ratings, absent content and
duplicate/conflicting objects are forbidden. Missing schema requires a founder
decision between minimal launch scope and explicit P1 defer; it is not `PASS`.

## 8. Internal links and crawl graph

Internal links and breadcrumbs point directly to final canonical URLs, not
legacy, redirects, 404/410. P0 pages are not orphaned and anchor text is not
mass-replaced with generic copy. Search `urlPath` equals canonical; the
publication indexing race must remain closed on integrated RC.

## 9. Media SEO

Broken images = 0; content type and fallbacks are valid; important source-backed
images and documented source gaps are accounted for. Private/hotlink URLs are
absent. Width/height prevent CLS, critical media does not regress LCP and alt
text is meaningful.

## 10. Integrated RC technical crawl

Produce status, canonical, robots/noindex and redirect chain/loop matrices;
duplicate/missing title, description, H1 and canonical reports; orphan report;
sitemap-vs-crawl and redirect-manifest-vs-crawl diffs; internal links to
redirect/404 report; server-rendered content proof; mobile sample.

Required results: unexplained indexable 4xx/5xx = 0; canonical to redirect,
non-200 or noindex = 0; P0 legacy URL without destination = 0.

## 11. SEO cutover runbook

Before launch freeze redirect checksum, expected sitemap counts,
canonical/status baseline, production redirect/robots backup, rollback
commands, SEO owner, monitoring dashboard and exact P0 smoke list.

During cutover validate DNS/HTTPS/host normalization, robots/noindex, sitemap,
P0 redirects, production-host canonical, 200/301/404/410 and analytics/Search
Console. Only then remove noindex and repeat all critical checks.

## 12. Post-launch monitoring

Check at 30–60 minutes, 24 hours, 72 hours, 7, 14 and 30 days. Monitor organic
traffic/conversions, landing pages, clicks/impressions/position, indexed pages,
404/410/5xx, redirect errors, sitemap processing, Google-selected canonical,
crawl stats, Core Web Vitals and drops by entity/city/template. Freeze alert
thresholds and rollback/repair policy before launch.

## 13. SEO Definition of Done

SEO Go/No-Go requires all of:

1. 100% P0 legacy URLs mapped and all known indexable legacy URLs classified.
2. Redirect loops = 0; P0 chains = 0; irrelevant homepage redirects = 0.
3. Canonical to non-200/noindex/redirect = 0; unexpected indexable 404/5xx = 0.
4. Sitemap contains only canonical indexable 200 URLs.
5. Private/DRAFT/PENDING/blocked URLs are not indexable.
6. P0 content/metadata parity and city duplicate control pass.
7. P0 internal links to legacy/redirect/404 = 0.
8. Search `urlPath` equals canonical.
9. Integrated RC crawl passes.
10. Cutover runbook, monitoring and thresholds are ready.
11. Open SEO P0 = 0.
12. Founder SEO Go/No-Go is recorded.
