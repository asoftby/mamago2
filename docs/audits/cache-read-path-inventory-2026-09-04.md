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
| Event discovery (`getKudaDiscoveryFeed`) | `now`-dependent visibility, sessions, active boosts, engagement, occasion boost, business quality, current-user owner-first ranking, optional weather ranking | mixed `FAST_PUBLIC` / contextual/private | **Do not cache final feed.** Cache only isolated reference reads now; measure stages before any candidate-cache or query rewrite |
| Discovery hub city expansion (`resolveKudaDiscoveryCityIds`) | Stable `City` reference lookup driven by static hub configuration; shared by Event feed/count and Plan suggestions | `REFERENCE` | Cache expanded hubs for 1h; preserve zero-DB fast path for non-hub cities |
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

## Phase 2.2 implementation — Discovery hub reference lookup

`resolveKudaDiscoveryCityIds` was identified as a safe repeated read inside the otherwise time/context-sensitive Event pipeline.

### What is cached

Only configured hub expansion, currently e.g. `minsk → minsk + marina-gorka`:

- source table: `City`;
- lookup fields: configured slugs;
- filter: `isLegacyNonCity = false`;
- result: `primaryCityId + expandedCityIds`.

The same resolver is consumed by Event discovery, Event count filtering, and Plan suggestions, so one reference cache removes repeated identical City reads across several surfaces.

### Cache key

The key includes:

- `hubCitySlug`;
- `hubCityId`;
- every configured extra city slug.

Including the static configuration values explicitly prevents a changed hub definition from sharing the prior cache identity.

### TTL and invalidation

- TTL: `60 * 60` seconds;
- no mutation tag in this phase, matching the existing `citySlug → cityId` reference-cache pattern;
- City/hub configuration changes are rare and the one-hour TTL is the safety boundary.

### Preserved behavior

- cities without configured expansion still return immediately with `[hubCityId]` and perform **zero DB reads**;
- final Event feed is not cached;
- `now`, sessions, active boosts, engagement, occasion/business quality, owner-first ranking and weather remain evaluated per request exactly as before.

## Why the final Event feed is not cached

`getKudaDiscoveryFeed` combines several dimensions that change at different rates:

1. time-based publication/session visibility;
2. active paid boosts;
3. engagement and occasion signals;
4. business quality score;
5. current-user ownership ordering;
6. optional weather ranking.

Caching the final feed would either create a key explosion or serve stale/personalized ranking across requests. The correct next design is to separate a bounded candidate projection from request-context ranking, measure query/TTFB cost, and only then decide whether a 1–5 minute candidate cache is worthwhile.

## Phase 2.3 implementation — Event discovery stage timings

Before changing the Event query or adding another cache layer, the runtime now measures the existing pipeline by stage:

1. `where` — public visibility/filter construction + discovery hub resolution;
2. `candidates` — primary `Activity.findMany` including images, sessions, category, location and active boost relation;
3. `cityLookup` — candidate city id → slug batch lookup;
4. `engagement` — weighted `UserEvent` aggregate;
5. `occasion` — active occasion boost lookup;
6. `businessQuality` — 30-day booking-quality data load/calculation;
7. `mapSort` — card projection, owner/weather score application and sort;
8. `total` — complete feed runtime.

`countKudaDiscoveryEvents` separately records `where`, `count` and total time.

### Environment and privacy rules

- timing is enabled on `APP_ENV=dev|development|staging|preview|local`;
- `DEBUG_DISCOVERY_PERF=false` can silence a non-production environment;
- `APP_ENV=production|prod` is always disabled, even if `DEBUG_DISCOVERY_PERF=true` is accidentally present;
- timing metadata contains only public `citySlug`, counts and boolean context flags;
- user IDs, event IDs and business IDs are never logged;
- instrumentation does not add `unstable_cache` to the final Event feed and does not change query/ranking behavior.

### Known candidates to evaluate after measurements

These are hypotheses only, not approved optimizations yet:

- primary `Activity.findMany`, especially the size of included sessions/images;
- weighted `UserEvent` aggregation;
- occasion relation lookup;
- `getBusinessQualityBoostMap`, which currently loads matching `BookingRequest` rows for 30 days and aggregates them in Node.

No query rewrite, DB index, candidate cache or Redis layer should be added until DEV timings identify a material hotspot.

## Next order

1. Confirm the deployed DEV build identity containing Phases 2.1–2.3.
2. Capture representative Event discovery timings on default `/minsk/kuda` plus common date/category/price-filter scenarios.
3. Optimize only the measured dominant Event stage; run `EXPLAIN (ANALYZE, BUFFERS)` first when the dominant stage is a DB query.
4. Split Place base data from upcoming-event reads.
5. Split Offer stable core from mutable schedule/review/booking data.
6. Audit Plan / Ideas and admin/business shell repeated client reads separately as `PRIVATE_SESSION` data.
