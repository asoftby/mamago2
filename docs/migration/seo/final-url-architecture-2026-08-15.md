# FINAL SEO-STABLE PUBLIC URL ARCHITECTURE — audit + preview backfill (2026-08-15)

Status: **IMPLEMENTED** (updated 2026-08-15, same day) — the owner made
the final call on the two open questions this doc originally raised (§2
Place, §3 Offer), and both are now built and verified. This remains
preparation for owner manual QA, not the redirect manifest itself (a
separate, later task once the owner has verified final URLs). No PROD
data was touched; no PROD/live WP was accessed in this or the prior
session.

This is a companion to `docs/migration/seo-migration-closure.md`/
`docs/migration/seo/redirect-audit-summary.md` — this doc defines the
*target* side (final mamaGo URLs) the next redirect reconciliation will
map legacy WordPress URLs onto.

## 2026-08-15 update: Place and Offer canonical contract implemented

Owner decision, same day as the original audit below: Place must be
city-scoped now (its slug uniqueness already is — `@@unique([cityId,
slug])` — a global-path canonical was a real cross-city collision risk),
and Offer's `{section}` must never be part of the canonical URL at all
(computed from stale/mutable fields, not identity). See BACKLOG-115 and
BACKLOG-116 (both now RESOLVED) for the full implementation writeup;
§1/§2/§3 below are kept as the original same-day audit for context but
are **superseded** by this update where they conflict.

**Final contract, as built:**

| Entity | Canonical |
|---|---|
| Place | `/{city}/places/{slug}` |
| Event | `/{city}/events/{slug}` (unchanged) |
| Offer | `/{city}/offers/{slug}` (no `{section}`) |
| Article (GLOBAL) | `/blog/{slug}` (unchanged) |
| Article (CITY) | `/{city}/blog/{slug}` (unchanged) |
| Route | `/routes/{slug}` (unchanged) |

- Place: `src/app/(public)/[city]/places/[slug]/page.tsx` is now the real
  canonical detail page (previously a redirect stub);
  `src/app/(public)/places/[slug]/page.tsx` is now the redirect-only
  legacy alias. City-scoped lookup: `findPlaceBySlugInCity()`
  (`src/lib/slug/placeSlugService.ts`).
- Offer: `src/app/(public)/[city]/offers/[slug]/page.tsx` is the new
  canonical; the old 3-segment route moved to
  `src/app/(public)/[city]/offers/[slug]/[legacySlug]/page.tsx` (Next.js
  requires sibling dynamic segments at one depth to share a param name,
  hence the directory rename — the route itself is unchanged, still
  `/{city}/offers/{section}/{slug}`, redirect-only) and
  `src/app/(public)/offers/[slug]/page.tsx` remains the global legacy
  alias. City-scoped lookup: `findOfferBySlugInCity()`
  (`src/lib/slug/offerSlugService.ts`), scoped by `Offer.cityId` — falls
  back to a global lookup only to find the real city for a redirect,
  never renders under a mismatched city (guards against a redirect loop
  when `Offer.cityId` is stale/unset, per BACKLOG-114).
- `resolvePlaceCanonicalUrl.ts` now requires `citySlug`;
  `resolveOfferCanonicalUrl.ts` dropped its `offer: {kind,...}` param down
  to just `slug` — section is structurally impossible to pass into the
  canonical path builder now, not just unused.
- Verified end-to-end in the browser (dev server, local DB): canonical
  Place and Offer pages render; `/places/{slug}`,
  `/{city}/offers/{section}/{slug}`, and `/offers/{slug}` all 301 to the
  new canonical.
- Cityless rows (can't get a canonical at all): 0/81 published Places
  locally; 2 PENDING Places (already slug-less, now also flagged
  `UNRESOLVED`/`NO_CITY` by the updated `seo-slug-backfill.ts`) — never
  guessed into a path.
- No schema/migration change was needed — `Place`/`Offer` were already
  `@@unique([cityId, slug])` before this task.

## 1. Final URL contract (original same-day audit — see update above for what shipped)

Almost the entire contract **already exists in the codebase** — this audit
found it, rather than needing to build it. Two entities deviate from what
was floated as a "preferred" contract, evidenced below, and are called out
as open questions rather than silently changed.

| Entity | Canonical | Status |
|---|---|---|
| Place | `/places/{slug}` | ~~Confirmed as-is — differs from a city-scoped preference. See §2.~~ **Superseded — now city-scoped, see update above.** |
| Event | `/{city}/events/{slug}` (id fallback only while slug is null) | Matches contract |
| Offer | `/{city}/offers/{section}/{slug}` | ~~Matches contract structurally; `{section}` computation has a data-quality caveat, see §3~~ **Superseded — `{section}` dropped, see update above.** |
| Article (GLOBAL) | `/blog/{slug}` | Matches contract, already live |
| Article (CITY) | `/{city}/blog/{slug}` | Matches contract, already live |
| Route | `/routes/{slug}` (no city segment) | Kept unchanged, per instruction — already the live canonical |

Evidence: `src/lib/seo/resolvePlaceCanonicalUrl.ts`,
`resolveEventCanonicalUrl.ts`, `resolveOfferCanonicalUrl.ts`,
`resolveArticleCanonicalUrl.ts` (delegates to
`src/lib/routing/cityPaths.ts`'s `buildArticlePublicPath`),
`resolveRouteCanonicalUrl.ts` — one resolver per entity, each already the
single source of truth for `<link rel="canonical">`/`generateMetadata()`.
Public route files: `src/app/(public)/places/[slug]/page.tsx`,
`src/app/(public)/[city]/events/[slugOrId]/page.tsx`,
`src/app/(public)/[city]/offers/[section]/[slug]/page.tsx`,
`src/app/(public)/blog/[slug]/page.tsx`,
`src/app/(public)/[city]/blog/[slug]/page.tsx`,
`src/app/(public)/routes/[slug]/page.tsx`.

## 2. OWNER_DECISION_REQUIRED — Place is not city-scoped in the URL, but its slug uniqueness is

**RESOLVED same day — see the 2026-08-15 update at the top of this doc.
The description below is the original audit finding, kept for context.**

`Place.slug` is `@@unique([cityId, slug])` (partial, per-city) — the
`20260608114243_city_scoped_slugs` migration deliberately moved Place off
a global-unique slug specifically to support multiple cities, with its own
comment noting this was "safe" only because a single city (Minsk) existed
at the time. But the **public canonical URL and lookup were never updated
to match**:

- `resolvePlaceCanonicalUrl.ts`'s `expectedPath` is hardcoded
  `/places/{slug}` — no city segment, by explicit design ("Never falls
  back to the internal DB id when a slug exists").
- `src/app/(public)/[city]/places/[slug]/page.tsx` exists only as a 301
  redirect *to* `/places/{slug}` — never rendered as its own page.
- `findPlaceBySlug()` (`src/lib/slug/placeSlugService.ts:293`) looks up by
  `prisma.place.findFirst({ where: { slug } })` — **no `cityId` filter at
  all**. Combined with per-city-only uniqueness, this is a real (if
  currently dormant) risk: once a second city exists, two Places in
  different cities could independently generate the same slug (nothing
  prevents it — slug generation itself only checks availability
  *within* the target city), and `/places/{slug}` would then resolve to
  whichever row Postgres returns first — silently, not a 404.

This was **not fixed in this task** — restructuring a canonical URL/lookup
that already has 81 PUBLISHED Places live behind it is a real architecture
change, explicitly out of scope for "не менять архитектуру вслепую."
**Owner decision needed before a second city launches**: either (a) make
Place city-scoped in the URL too (`/{city}/places/{slug}`, flipping which
of the two existing routes is canonical vs. redirect-only — mirrors how
Offer already does this correctly), or (b) keep `/places/{slug}` and
enforce *global* slug uniqueness at the application layer (stricter than
the current per-city DB constraint). Tracked in
`docs/engineering/backlog.md`.

## 3. Offer `{section}` is computed, not stored — and has stale branches

**RESOLVED same day — see the 2026-08-15 update at the top of this doc.
The description below is the original audit finding, kept for context.**

`getOfferPublicSection()` (`src/lib/offers/offerPublicUrl.ts:16-47`)
computes the URL's `{section}` segment at request time from
`offer.kind`/`durationType`/`campProgramType`, branching on string
literals (`"CLASS"`, `"PARTY"`, `"VISIT"`, `"SERVICE"`, `"EVENT"`, etc.)
that don't all match the current `OfferKind` enum (schema only has
`EVENT | SERVICE` today) — apparent dead branches from a wider historical
kind set. The schema also has an `OfferProductType` enum (`PLACE_VISIT |
ONE_TIME_ACTIVITY | REGULAR_ACTIVITY | CAMP | PARTY_SERVICE |
PARTY_PACKAGE`) that looks like a more natural fit for a stable URL
section, but `getOfferPublicSection()` never reads it, and no WordPress
import or business flow currently sets `productType`/`kind` consistently
(`normalizeOffer.ts` explicitly notes "no productType/kind/category
classification" from WP).

**Not changed in this task** — redefining what the canonical set of
`{section}` values should be is a product/taxonomy decision, not a
technical cleanup; also, `findOfferBySlug()` looks up by slug only (no
city or section filter), so the URL's `{section}`/`{city}` segments are
currently cosmetic for resolution purposes, same latent-collision shape as
Place §2. Flagged as OWNER_DECISION_REQUIRED + backlog.

## 4. Article GLOBAL vs. CITY scope

Already a first-class, DB-enforced concept — not something this task had
to build:

- `Article.geoScope` (`GeoScope { CITY, COUNTRY }`) + `Article.cityId`,
  with a DB `CHECK` constraint
  (`article_geoscope_city_consistency`) enforcing `COUNTRY→cityId NULL`,
  `CITY→cityId NOT NULL`.
- Admin editor (`PublicationGeoScopeField.tsx`) makes this a **required**
  field before publish: *"Обязательно перед публикацией. Определяет URL и
  аудиторию материала."*
- The WordPress import pipeline (`ArticleCommitWriter.ts`) **deliberately
  never sets `geoScope`/`cityId`** on create — confirmed by reading the
  exact `prisma.article.create()` data shape, which omits both keys. This
  is documented as intentional in
  `docs/migration/wordpress-to-mamago.md`: imported Articles land as
  drafts in a review queue: *"the editor resolves these manually before
  publish."* WordPress category/tag terms are captured verbatim as
  `sourceTerms` but are never interpreted as a city signal.
- A one-time SQL backfill (`20260609180000_article_city_scoped`) set
  `geoScope='CITY', cityId=<minsk>` for every `Article` row that existed
  in the DB **at that migration's apply time** (2026-06-09) — this is
  historical data cleanup tied to a timestamp, not logic in the current
  import pipeline, and does **not** retroactively apply to rows created
  later (i.e., the real Phoenix-migrated Articles created afterward).

**Classification rule** (`src/lib/seo/classifyArticleScope.ts`, new in
this task — pure, deterministic, unit-tested):

```
geoScope === "COUNTRY"            → GLOBAL  → /blog/{slug}
geoScope === "CITY" && cityId set → CITY    → /{city.slug}/blog/{slug}
anything else (including null)    → UNKNOWN → OWNER_DECISION_REQUIRED, never assigned
```

**Real PROD counts for the 116 migrated Articles were not computed in
this session** — this session had no PROD/live-WP access (explicitly out
of scope). What this task delivers is the classification mechanism itself
(`classifyArticleScope` + `scripts/seo-slug-backfill.ts --entities
article`, always report-only), ready to run against PROD in an authorized
follow-up. Run locally against the (much smaller, non-representative)
local dev DB as a mechanism proof:

```
{"entity":"article","mode":"REPORT_ONLY","globalCount":1,"cityCounts":{"minsk":25},"unknownCount":0,"noSlugCount":0}
```

(26 local Articles total — not the real 116; all already classified
because this local dataset predates/postdates the Phoenix import
differently. This number is not meaningful for PROD planning — it only
demonstrates the report runs correctly.) Given the import pipeline never
sets `geoScope`, the expectation for the real 116 PROD-migrated Articles
is that most or all currently classify as **UNKNOWN** until an editor (or
an owner-approved, evidence-based rule — never a title guess, never a
blanket Minsk default) resolves them.

## 5. Event CUID

No code change needed — `resolveEventCanonicalUrl.ts`'s
`expectedPath` already prefers slug (`slug?.trim() || id`), and the public
route `/{city}/events/{slugOrId}` already accepts either form permanently
(dual-mode resolution baked into the route itself, not a redirect). Once
the 6 currently slug-less Events get a slug via
`seo-slug-backfill.ts --entities event`, their canonical automatically
becomes slug-based — no separate CUID→slug redirect alias is needed; the
existing route already *is* the backward-compatible alias.

## 6. Slug data model — already fully built, no schema change made

`Place`/`Activity`/`Offer`/`Article` all already have: `slug String?`
(nullable — DRAFT-safe), `@@unique([cityId, slug])` (partial, collision-
safe per scope; Article additionally has a second partial unique for
`cityId IS NULL` rows), a `*SlugHistory` table checked before accepting a
new slug (so a retired slug is never reissued), and a same-titled-editor
`update*Slug()` path (`src/lib/admin/seo/entities/applyEntitySeoUpdate.ts`)
that records history before changing. `Route.slug` is plain global-unique
(never migrated to city-scoping, consistent with its non-city-scoped
canonical). **No schema migration was needed for this task.**

Title-rename-preserves-slug is enforced at every layer that matters:
business/admin update handlers only ever call the idempotent
`assign*SlugIfMissing()` (no-op once slug is set), and Phoenix's
`ArticleCommitWriter.buildArticleUpdateData()` explicitly excludes
`slug`/`title` from reprocess updates. Added one regression test for the
underlying preview helper (`buildSlugPreview`) asserting this exact
invariant (`src/lib/slug/publicSlug.test.ts`).

## 7. Create flows — already correctly wired

- **Business** (Place/Event/Offer): create routes call
  `assign*SlugIfMissing()` — confirmed for all three.
- **Admin**: no separate "admin creates a new Place/Event/Offer" API route
  exists at all (`src/app/api/admin/places/` etc. only expose
  moderation/claims/search on *existing* records) — creation is
  exclusively business-initiated, and that path is correctly wired.
  Article is the one entity with its own admin create/edit flow
  (`src/lib/article/articleAdminService.ts`), also correctly wired
  (`resolveArticleSlugOnSave` → `assignArticleSlugIfMissing`).
- **Importer** (Phoenix): Place/Event/Offer commit writers leave `slug:
  null` on create by design (assigned later, on publish-path, via the same
  `assign*SlugIfMissing()` idempotent functions) — this is why the
  backfill in §8 exists at all.

**New Place/Event/Offer/Article records get a permanent, stable URL from
day one.**

## 8. Backfill mechanism (new deliverable)

`scripts/seo-slug-backfill.ts` (`pnpm seo:slug-backfill`) — local-DB only
by default, same fail-closed `assertMigrationDatabaseTarget` gate as the
Phoenix importers (PROD requires `--confirm-production` on top of
`--confirm-writes`; this script never uses SSH or touches live WordPress,
only this app's own Postgres).

- **`--preview`** (default-safe): for Place/Event/Offer with `slug IS
  NULL`, calls the *existing* pure candidate-generation functions
  (`generatePlaceSlug`/`generateActivitySlugFromTitle`/
  `generateOfferSlugFromTitle` — no new slug logic invented) and reports
  `id, title, cityId, proposedSlug`, flagging any slug that would collide
  with another proposal in the same preview batch (per-city). Zero writes.
  Article is always a GLOBAL/CITY/UNKNOWN count report (§4), never a
  slug/city proposal.
- **`--confirm-writes`**: calls the exact same production-safe
  `assign*SlugIfMissing()` functions already used by the business/admin
  update paths — idempotent (no-op if a slug already exists), so a rerun
  never changes an already-correct slug. Article is still report-only in
  this mode too.

Verified end-to-end against the local dev DB in `--preview` mode (see §4
for the Article report; Place/Event preview output matched expectations,
0 errors, 0 in-batch collisions). `--confirm-writes` was not executed in
this session (would mutate shared local dev DB state; the underlying
`assign*SlugIfMissing()` functions are already covered by existing
production test suites, so re-proving them here would be redundant).

## 9. Known soft mismatch flagged for the next redirect reconciliation

`/pervyy-detskiy-sad-severnogo-berega` (legacy URL) vs. the current target
slug looking semantically different — not investigated/fixed here per
instruction ("не исправлять конкретный redirect сейчас"). Recorded so the
next reconciliation pass knows to check it explicitly rather than assume a
clean 1:1 slug carryover.

## 10. Deferred / non-blocking (see `docs/engineering/backlog.md`)

- Slug redirect history after a manual slug edit (feature, not a bug —
  `*SlugHistory` tables exist and are written, but nothing yet serves a
  301 off them for every entity's public route).
- Three separate Cyrillic transliteration/slugify implementations
  (`src/lib/slugify.ts`, `src/lib/slug/slugUtils.ts`,
  `src/lib/slugifyLabelToValue.ts`) — each correctly used by its own
  entity today, no bug, but a consolidation candidate.
- ~70+ scattered manual `` `/places/${slug}` ``-style internal `href`
  template literals (Place, Route, Event, blog) that don't go through the
  existing `resolve*CanonicalUrl` builders — those builders are the
  correct single source of truth for canonical *metadata*, but plain
  internal links aren't required to use them yet.
- Three independent implementations of "resolve the public base host"
  (`src/lib/config/publicAppUrl.ts`, `src/lib/seo/globalNoindex.ts`,
  `src/lib/seo/buildOgMeta.ts`) — currently consistent in practice
  (`mamago.by` prod default), but a duplication risk.
- Place city-scoped canonical (§2) and Offer section taxonomy (§3) —
  OWNER_DECISION_REQUIRED, not backlog-only, but no code change is queued
  until a decision is made.
