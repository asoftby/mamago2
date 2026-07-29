# External SEO baseline required for full Go/No-Go

Local technical SEO closure (canonical, sitemap, robots/noindex, redirect
manifest, structured data, city-duplicate control) is complete — see
`docs/migration/prelaunch-checklist.md` §5.7 and `docs/migration/seo-migration-closure.md`
§13. It does not require or depend on the exports below. They gate only the
**full** SEO Go/No-Go (priority classification of legacy URLs against real
traffic/backlink evidence, and the founder decision itself).

No exports of this kind were found locally as of 2026-07-29.

## Google Search Console

- Pages / Indexing report
- Search results — Pages
- Search results — Queries (clicks, impressions, CTR, average position)
- Sitemap status
- Core Web Vitals
- Crawl stats
- Manual actions
- Security issues

Periods: last 16 months (seasonality), plus separately last 3 months and
last 28 days.

## Analytics

- Organic landing pages
- Sessions / users
- Conversions
- Device breakdown
- City breakdown
- Engagement

Periods: last 12 months, plus separately last 90 and 30 days.

## Backlinks

- Source URL
- Target legacy URL
- Referring domain
- Authority/quality signal, if available

## What these unlock

- Replacing the coarse `EXACT_REDIRECT`/`VALID_HUB_REMAP`/
  `P1_START_OR_CONTAINS`/`INVALID_TARGET` disposition classification
  (`docs/migration/seo/redirect-audit-summary.md`) with real P0/P1/P2
  traffic-evidenced priorities for the 836 `INVALID_TARGET` legacy rows —
  currently undifferentiated because no local evidence exists to tell a
  high-traffic gone page from a truly irrelevant one.
- A founder-reviewable content/metadata parity pass focused on actual
  top-traffic pages, rather than a representative sample.
- The cutover runbook's rollback thresholds and post-launch monitoring
  alert baselines (§11–12 of `seo-migration-closure.md`), which need a
  pre-migration traffic/indexing baseline to compare against.
- The founder SEO Go/No-Go decision itself (`seo-migration-closure.md` §13,
  item 12).

## Status until provided

```
SEO LOCAL TECHNICAL CLOSURE: COMPLETE / PASS
EXTERNAL TRAFFIC-BASED LEGACY URL REVIEW: P1 DEFERRED
NEXT PHASE: PRODUCT REGRESSION / RC READINESS
```

Search Console/Analytics/backlink exports remain required for the later
traffic-prioritized review and founder full SEO Go/No-Go. Their absence does
not block the P0 local technical closure or starting RC regression.
