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

---

# Production build crawl

Node 22.23.1, `pnpm build` with `APP_PUBLIC_URL=https://mamago.by`,
`NEXT_PUBLIC_APP_URL=https://mamago.by`, `SITE_INDEXING_ENABLED=true`,
`REQUIRE_REDIRECT_MANIFEST=1` — build succeeded, `[redirect-manifest]`
loaded all 893 rules under `require: true` (fail-loud) with no issues.
Served via the actual `output: standalone` artifact
(`node .next/standalone/server.js`, `.next/static` copied in per the
standard manual step for standalone deployments — `next start` errors on
this config) on port 3076, `NODE_ENV=production`.

Ran the verifier against `http://localhost:3076` with
`--expected-origin https://mamago.by` (the app is configured for the real
production domain while physically served from localhost).

**First run** found one non-P0 issue: `https://mamago.by ::
CANONICAL_TO_REDIRECT_SOURCE_IN_SITEMAP`. Investigated: this is
`NODE_ENV=production`-specific — the public surface's own middleware
(`resolveSubdomainMiddlewareDecision`) unconditionally 307-redirects `/`
to the flagship city hub outside dev/localhost (an early
`isDevLocalHost()` bypass in dev mode means this never fires on `localhost`
there, which is why the dev-mode pass on port 3075 never surfaced it).
Pre-existing, intentional production behavior — not a regression. Fixed by
removing the sitemap's separate root entry and instead giving the flagship
city's own hub entry priority 1, since that's what `/` actually resolves
to; sitemap entries should resolve directly to 200, not redirect.

Also found and fixed a verifier-only bug: it tried to literally fetch the
sitemap's absolute `https://mamago.by/...` URLs instead of rewriting them
to the local server under test — added `toFetchUrl()` to redirect the
network fetch (not the reported URL) from `EXPECTED_ORIGIN` to `BASE_URL`.

**Second run** (after both fixes, rebuilt + restandalone):

```
sitemap: 199 urls (was 200 — root entry removed, no duplicate introduced), 0 duplicates
pages crawled: 199, pages with issues: 0
legacy redirect samples: 20, broken: 0
city-duplicate probes: 2, failing: 0
P0 found: none
```

## Production spot checks

- `robots.txt`: `Allow: /` + `Sitemap: https://mamago.by/sitemap.xml` —
  correct production origin.
- `/places/molekula` canonical: `https://mamago.by/places/molekula` and
  `<meta name="robots" content="index, follow">` — **confirms production
  origin never leaks to localhost**, even though physically served from
  `localhost:3076` (directly answers the phase's stop condition
  "production origin остаётся localhost" — it does not).
- Media: files were already present in `.next/standalone/storage/uploads`
  (482 files) — Next's build-time file tracing followed this worktree's
  symlinks and copied the real file contents into the standalone bundle
  automatically; no extra step needed for the production crawl.
