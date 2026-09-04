# Cache read-path inventory — 2026-09-04

Status: Phase 2 in progress  
Policy: `docs/engineering/cache-policy.md`

## Scope

Initial public read-path audit for Articles, Events, Offers and Places. The goal is to remove repeated database work without making time-sensitive or personalized data stale.

## Inventory

| Surface / read path | Current shape | Cache class | Decision |
| --- | --- | --- | --- |
| City journal list / city-home journal (`listCityHomeArticles`) | Deterministic published Article query; no request user and no `now`; geography shapes membership | `PUBLIC_CATALOG` | Cache 1h safety TTL + explicit article invalidation + category mutation dependency tag |
| National `/blog` list (`listNationalBlogArticles`) | Deterministic COUNTRY published Article query; no request user and no `now` | `PUBLIC_CATALOG` | Cache 1h safety TTL + same article list invalidation tag |
| Article detail (`loadArticleMvpBySlugPublic` / resolved blocks) | Article + media + embedded Event/Offer/Place/Route/Article cards; Offer embeds can contain schedule/pricing data | mixed `PUBLIC_CATALOG` / `FAST_PUBLIC` | **Do not cache as one object yet.** Model dependency tags or split stable article body from embedded dynamic projections first |
| Event discovery (`getKudaDiscoveryFeed`) | `now`-dependent visibility, sessions, active boosts, engagement, occasion boost, business quality, current-user owner-first ranking, optional weather ranking | mixed `FAST_PUBLIC` / contextual/private | **No broad cache.** Split stable/short-lived candidate pool from per-request contextual ranking first |
| Offer detail (`getOfferPageData`) | Offer + Place + reviews + discovery signals + camp sessions/pricing + CTA/booking-related fields | mixed `PUBLIC_CATALOG` / mutable sub-data | **No broad cache yet.** Split stable offer core from mutable schedule/review/booking projections or define complete invalidation coverage |
| Place detail / upcoming events | Stable place data combined with `now`-dependent upcoming Activity reads | mixed `PUBLIC_CATALOG` / `FAST_PUBLIC` | **No broad detail cache yet.** Separate base Place projection from upcoming Events before caching |

## Phase 2.1 implementation — Article journal lists

### Cache key

City cache identity includes:

- `city.id` — geography membership;
- `city.slug` — canonical href fallback;
- `city.regionId` — REGION-scope discovery membership.

National journal uses one static cache identity.

### TTL

`60 * 60` seconds is a safety net, not the primary consistency mechanism.

### Invalidation

`PUBLIC_ARTICLE_LIST_CACHE_TAG = public-articles:list`

Immediate invalidation is wired for the normal runtime mutation paths:

- create Article when the resulting status is `PUBLISHED`;
- every successful Article PUT, because it can publish/unpublish, change geography, title, category, tags or ordering timestamps;
- archive Article;
- DiscoveryTag PATCH / disable, because public journal cards render active tag title/slug.

Article list cache also subscribes to the existing EventCategory mutation tag `event-step1-categories`. The shared `EventCategory` admin routes already invalidate that tag after successful normal update/delete, which keeps list-facing article category title/slug fresh without duplicating taxonomy mutation logic.

Draft/archived delete does not invalidate because the lifecycle route only deletes non-public records.

### Deliberate exclusions

- Article view counter does **not** invalidate lists: views are not part of this projection.
- SEO/canonical-only writes do not invalidate lists unless they flow through the Article editor PUT that also owns list-facing fields.
- Article detail remains uncached in this phase.
- No Redis or distributed result cache is introduced.

## Why Events are not the first cache slice

`getKudaDiscoveryFeed` combines several dimensions that change at different rates:

1. time-based publication/session visibility;
2. active paid boosts;
3. engagement and occasion signals;
4. business quality score;
5. current-user ownership ordering;
6. optional weather ranking.

Caching the final feed would either create a key explosion or serve stale/personalized ranking across requests. The correct next design is to separate a bounded candidate projection from request-context ranking, then measure whether a 1–5 minute candidate cache is worthwhile.

## Next order

1. Verify Article journal list cache on DEV with repeated requests and a publish/edit invalidation smoke.
2. Measure Event discovery query count/TTFB and decompose candidate retrieval vs contextual ranking.
3. Split Place base data from upcoming-event reads.
4. Split Offer stable core from mutable schedule/review/booking data.
5. Audit Plan / Ideas and admin/business shell repeated client reads separately as `PRIVATE_SESSION` data.
6. Only after hot paths are measured, run `EXPLAIN (ANALYZE, BUFFERS)` on representative DB data and add compound indexes where the plan proves they are useful.
