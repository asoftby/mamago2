# Canonical / search-index / redirect audit — Places & Offers — 2026-07-28

## Canonical `<link>` rendering

| Entity | DB field populated | HTML `<link rel="canonical">` rendered | Verdict |
| --- | --- | --- | --- |
| Place (`/places/[slug]`) | yes, for all 5 published | **no** — confirmed empirically (browser fetch, all 5) | **P0: `PLACE_CANONICAL_METADATA_MISSING`** (new finding, same class as the already-backlogged `ROUTE_CANONICAL_METADATA_MISSING`) — `generateMetadata()` never selects/reads `Place.seoCanonicalUrl`. |
| Offer (`/offers/[slug]`) | n/a — all 63 still `DRAFT`/no slug, can't browser-verify live | **code confirmed correct** (`page.tsx:96,107`: reads `seoCanonicalUrl`, sets `alternates.canonical`) | PASS at the code level; live verification blocked only by no Offer being publicly reachable yet, not by a defect. |

Not fixed in this session (frontend SEO fix, its own scoped slice, consistent with this closure's
"don't turn this into new architecture" principle) — added to backlog alongside the Route one, same
severity bar (P0: reproducible, produces a real absent-canonical defect on every published Place
page today).

## Search indexing

`extendPrismaWithSearchIndexing()` (`src/lib/search/prismaSearchExtension.ts`) fires the same
fire-and-forget, unawaited, no-ordering-or-dedup upsert pattern for `place.update`/`place.upsert` and
`offer.update`/`offer.upsert` that produced `EVENT_SEARCH_INDEX_PUBLICATION_RACE` for Events. **The
defect class is structurally applicable to Place/Offer too** — same shared infrastructure, same
"two updates in the same publish flow race to write `SearchDocument`" shape.

**However**, it did not reproduce in this session's testing, for a specific, verifiable reason: all
migration-driven Place/Offer writes (`scripts/migration-commit-wordpress-db.ts`) deliberately
construct their own bare `new PrismaClient()`, never `@/lib/prisma` — so migration writes never go
through this extension at all, and never trigger the race. The race would only become live for
these two entities the moment they're published through the **normal admin/business app flow**
(`approveOffer`, Place moderation `approvePlace`), which does use the extended client — the same way
it was for Events. Since none of the 63 Offers and only the 4 pre-existing manually-published Places
have gone through that flow yet, this session had no fresh publish event to reproduce it against.
**Not re-investigated further this session** (matches the existing Events backlog item's own note:
"not re-investigated this session" is an acceptable posture two sessions running, since the shared
fix is explicitly out of scope for entity-specific closures) — flagged as inherited backlog
applicability, not a new defect introduced or fixed here.

## Migration writes and canonical/slug freshness

Confirmed (via direct code reading, both entities): because the migration commit script bypasses
`@/lib/prisma`'s extension, migrated Place/Offer rows never get `syncPlaceCanonical`/
`syncOfferCanonical` called as part of import — `seoCanonicalUrl` and `slug` for migrated rows are
populated later only by *app-level* actions (an editor's admin edit, the publish flow, etc.), never
by the migration path itself. This is not a bug — Place's own 4 manually-published records prove the
downstream path works when actually exercised — but it does mean "migrated" is never synonymous with
"has a working canonical/slug," a distinction worth keeping explicit in the checklist rather than
implying migration alone finishes SEO readiness.

## Redirects

- 893-row legacy WordPress redirect manifest loaded and active (confirmed via dev server startup
  log: `[redirect-manifest] Loaded 893 redirect rules`).
- Neither Places nor Offers have any slug *changes* from this session (0 `PlaceSlugHistory` rows
  touched; all 63 Offers still have `slug: null`, unchanged) — so there is no new redirect-collision
  surface introduced by this closure. Redirect-manifest coverage for Place/Offer legacy URLs was not
  separately re-audited against the full 893-row manifest this session (out of scope — no slug
  activity occurred here to necessitate it, same posture as Routes' own "not separately re-verified
  this session" note for its 14 records).
