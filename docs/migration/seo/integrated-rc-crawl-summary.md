# Dev crawl — integrated RC (SEO closure branch)

Branch `fix/seo-migration-closure`, Node 22.23.1, port 3075,
`NEXT_PUBLIC_APP_URL=http://localhost:3075`, `.next` cleared before start.

## Pass 1 — indexing disabled (default/prelaunch policy)

No `SITE_INDEXING_ENABLED` set (default `isGlobalNoindexEnabled()` = true).

```
robots.txt:        Disallow: /
homepage:           X-Robots-Tag: noindex, nofollow
                     <meta name="robots" content="noindex, nofollow">
sitemap.xml:         empty <urlset> (correct — no indexable content while noindex)
/places/molekula:    canonical = http://localhost:3075/places/molekula
                     (correct live origin, not stale mamago.local:3000)
```

Meta robots and X-Robots-Tag agree; no contradiction. Matches documented
prelaunch policy exactly.

## Pass 2 — indexing enabled (`SITE_INDEXING_ENABLED=true`)

```
robots.txt:  Allow: /  +  Sitemap: http://localhost:3075/sitemap.xml
```

Ran `scripts/verify-prelaunch-seo.ts --base-url http://localhost:3075
--timeout-ms 15000 --concurrency 5 --max-urls 250 --redirect-samples 20`
twice — before and after the sitemap inactive-city fix found during this
pass (see below).

**First run** (before fix):

```
sitemap: 211 urls, 0 duplicates
pages crawled: 211, pages with issues: 7
  — all 7: /ratomka/offers/programs/* :: CANONICAL_TO_REDIRECT_SOURCE_IN_SITEMAP
legacy redirect samples: 20, broken: 0
city-duplicate probes: 2, failing: 0
P0 found: none (the 7 issues were below the P0 threshold as a warning code,
  but were a real canonical-to-redirect defect — investigated immediately
  per the explicit stop condition, not deferred)
```

**Root cause found**: `ratomka` is a real `City` row (with a published
Place and 7 published Offers) but `isActive: false`, and not present in the
static `KNOWN_CITY_SLUGS` allowlist that `wpLegacyCatchAll.ts` uses at
Edge-middleware time (can't query the DB there). The sitemap included these
7 Offers as if they were live canonical 200 pages; visiting them actually
301-redirected to `/minsk` via the WP legacy catch-all before the Offer
page ever rendered. Fixed by excluding `isActive: false`-city content from
the sitemap (matching the pre-existing city-hub loop's own filter) —
committed separately. Two other inactive cities (`mir`, `kopische`) had
Places with the same latent issue (not yet visibly broken since Place has
no city-scoped route, but excluded from sitemap for the same reason).

**Second run** (after fix):

```
sitemap: 200 urls (211 - 7 offers - 4 places), 0 duplicates
pages crawled: 200, pages with issues: 0
legacy redirect samples: 20, broken: 0
city-duplicate probes: 2, failing: 0
P0 found: none
```

## Spot checks (indexing enabled)

- **Favicon P2**: `/favicon.ico` → 307 → `/api/media/file/...` → **200**,
  real WebP image data (512×512, matches the `ACTIVE` `MediaAsset` DB row).
  Resolved by the media-runtime symlink set up earlier this phase — no
  code change needed. **Closed.**
- **Event canonical**: present and correct
  (`http://localhost:3075/minsk/events/interaktivnyy-kvest-mir-naoschup`,
  matches the JSON-LD `Event.url` exactly) — confirms the
  `alternates.canonical` fix (was completely absent before this phase).
- **JSON-LD** on the same Event page: Organization + WebSite (site-wide,
  once), Event, BreadcrumbList, FAQPage — all origins consistent, `url`
  fields match canonical, no localhost/stale-origin leakage.
- **Route canonical**: `http://localhost:3075/routes/novogodniy-marshrut` —
  correct, single canonical.
- **MutationObserver TypeError**: attempted reproduction via a real browser
  (Event, Place, Route, Offer, Article pages) — **not reproduced** on any
  page in this environment; only normal dev-mode HMR/Fast-Refresh/
  ReloadProbe debug logging observed, no errors. Classified `DEV_ONLY /
  NOT_REPRODUCED` per instruction not to deep-dive without a real,
  reproducible user-facing defect.

## Server log

No unexplained server errors during either pass. `[redirect-manifest]
Loaded 893 redirect rules` confirmed on every start.
