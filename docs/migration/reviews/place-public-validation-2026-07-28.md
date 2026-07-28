# Place public validation — 2026-07-28

Live browser smoke against this worktree's own dev server (localhost:3000, same shared local DB).

## All 5 PUBLISHED Places

| slug | HTTP | Title correct | Canonical `<link>` | Notes |
| --- | --- | --- | --- | --- |
| `pugovka-na-ratomskoy-7` | 200 | yes | **missing** | Full content render verified: breadcrumb (Главная→Минск→...), category badge, address, district, phone/Instagram, hours grid, 14 reviews rendered. 0 console errors, desktop+mobile clean. |
| `nevidimyy-mir` | 200 | yes | **missing** | out-of-migration-scope seed Place, still renders correctly |
| `family-slub-femili-klub` | 200 | yes | **missing** | |
| `pugovka-na-vostochnoy-137` | 200 | yes | **missing** | |
| `atmosfera` | 200 | yes | **missing** | |

**PLACE_CANONICAL_METADATA_MISSING (P0, new finding, same defect class as the already-backlogged
`ROUTE_CANONICAL_METADATA_MISSING`)**: `src/app/(public)/places/[slug]/page.tsx`'s
`generateMetadata()` never selects/reads `Place.seoCanonicalUrl` — confirmed empirically, all 5
published Places render zero `<link rel="canonical">` tags, even though `seoCanonicalUrl` is
correctly populated in the DB for all 5 (e.g.
`http://mamago.local:3000/places/pugovka-na-ratomskoy-7`). `og:url` *is* set correctly (via
`buildOgMeta`), so the value exists and is threaded into some metadata, just not `alternates.canonical`.
Contrast: `src/app/(public)/offers/[slug]/page.tsx` already does this correctly (reads
`seoCanonicalUrl`, sets `alternates.canonical`) — the fix pattern already exists in the same
codebase, just not applied to Place. Not fixed in this session (frontend SEO fix, separate scoped
slice per this closure's own principles) — backlogged alongside the Route one.

## Access control

- PENDING place (`be-english`) → **404**, confirmed not publicly reachable. Correct.

## Dual-route observation (backlog, not necessarily a bug)

Both `/places/[slug]` and `/[city]/places/[slug]` serve the same Place with 200 OK (e.g.
`/places/pugovka-na-ratomskoy-7` and `/minsk/places/pugovka-na-ratomskoy-7` both render). The DB's
own `seoCanonicalUrl` points at the non-city-prefixed form, so that's presumably the intended
canonical — but since canonical isn't actually rendered at all (see above), there's currently no
signal telling search engines which of the two is authoritative. Once the canonical-link fix lands,
confirm it points at the right one of these two routes. Flagging as part of the same SEO backlog
item, not a separate defect.

## Discovery

No dedicated `/[city]/places` (or `/minsk/places`) listing route exists in the app (confirmed:
`src/app/(public)/[city]/places/` only contains a `[slug]` detail route, no index `page.tsx`) — Place
discovery happens through the general search/category browsing surfaces, not a dedicated city+places
index page. Did not find a regression here; this is the existing, pre-migration site architecture,
not something Places migration closure changed or needs to add.

## Mobile

375×812 viewport: renders correctly, no layout breakage, 0 console errors (verified on
`pugovka-na-ratomskoy-7`).
