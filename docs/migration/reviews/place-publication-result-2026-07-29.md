# Place LOCAL publication closure — result — 2026-07-29

Worktree `mamago2-places-offers-publication`, branch `feat/places-offers-publication-closure`,
base `feat/places-offers-production-media-closure`@`74bcb483`.

## 1. `PLACE_CANONICAL_METADATA_MISSING` — fixed first, before any publication

`src/app/(public)/places/[slug]/page.tsx`'s `generateMetadata()` never selected or read
`Place.seoCanonicalUrl`. Fixed via a small pure helper,
[`resolvePlaceCanonicalUrl.ts`](../../../src/lib/seo/resolvePlaceCanonicalUrl.ts): prefers the
stored `seoCanonicalUrl`; otherwise falls back to the same slug-first path
`syncPlaceCanonical()` itself computes; never falls back to the internal DB id when a slug exists.
5 unit tests in `resolvePlaceCanonicalUrl.test.ts` (stored-preferred, slug-fallback,
never-id-when-slug-exists, id-only-when-no-slug-at-all, blank-string-treated-as-absent). The
`[city]/places/[slug]` route re-exports the same `generateMetadata`, so both routes are fixed by
one change. Verified against real HTML on a running dev server (see §4).

**Important process note**: verification of this fix was initially blocked by an environment
mistake, not a defect in the fix — the `dev` preview always launches from the main repo checkout,
not the active worktree (a session-level quirk discovered here, affecting every prior "browser
smoke" claim across this whole prelaunch effort that relied on the shared `name: "dev"` preview).
Worked around by starting `next dev` manually inside this worktree. All fixes below were verified
against that correctly-scoped server.

## Browser proof provenance

```text
branch:        feat/places-offers-publication-closure
HEAD:          74bcb483925d6c96a74eeb8ee9a0053b1b8a44f8
worktree path: /Users/shapovalovalexey/dev/mamago2-places-offers-publication
pwd (before launch): /Users/shapovalovalexey/dev/mamago2-places-offers-publication
launch command: rm -rf .next && npx next dev --webpack -p 3050
port:          3050
URLs checked:  http://localhost:3050/places/pugovka-na-ratomskoy-7
               http://localhost:3050/places/atmosfera
               http://localhost:3050/places/pugovka-na-vostochnoy-137
               http://localhost:3050/places/trapetsiya (+ all 76 newly-published slugs, §6)
               http://localhost:3050/places/be-english (CITY_BLOCKED control)
               http://localhost:3050/places/shkola-arhitekturnogo-myshleniya-dlya-detej (CITY_BLOCKED control)
```

Proof that the served HTML reflects this exact HEAD: `.next` was deleted before this launch (no
stale build carried over), and the rendered `<link rel="canonical">` value on every checked page
matches exactly what `resolvePlaceCanonicalUrl()` — a function that did not exist before this
session's commit — computes; the same URLs returned no canonical tag at all when checked against
the (stale, wrong-worktree) server earlier in the session, before this fix and before switching to
the correctly-scoped server. No PID, cookie, session token, or other volatile runtime value is
recorded above or elsewhere in this doc.

## 2. Exact 76-key manifest

Built from the already-committed, arithmetically-verified status/classification matrix
(`place-status-classification-matrix-2026-07-28.json`), re-verified live against the DB at
manifest-build time (0 drift). [`place-publication-manifest-2026-07-28.json`](./place-publication-manifest-2026-07-28.json):
**76 rows, 0 duplicate ids, 0 duplicate sourceRecordKeys, 0 duplicate city-scoped slugs.**
Excluded and left untouched: 4 `UPDATE_CONFLICT_PROTECTED` (437/895/5389/43023), 2 `CITY_BLOCKED`
(32409/60742), 1 non-migration seed.

## 3. Preview → batch execution

Preview (dry precondition check, no writes): 76/76 clean, 0 errors.

Batch execution used the **existing** `approvePlace()` admin lifecycle service (never a raw
`status = PUBLISHED` update) via a temporary, local-only, non-production-gated Next.js API route
(`bulk-place-publish-temp`, deleted immediately after use — needed only because `approvePlace()`
transitively requires the Next.js bundler to resolve a `server-only`-guarded import, so it can't run
from a bare script; see the process note above about attempting and rejecting a module-loader-patch
workaround for the same reason, correctly blocked by the session's safety classifier).

```text
Result: 76/76 PUBLISHED, 0 errors, 0 stop points.
```

One record (`wordpress-db:places:10343`) hit the same `server-only` crash on its *first* attempt
via the bare-script version of the runner, after its DB transaction had already committed
(status→PUBLISHED, slug assigned) but before the runner's own bookkeeping finished — a genuine
partial-success/resume case, not a data error. The route-based rerun correctly detected it as
already-published-and-consistent and resynced canonical/search for it rather than re-publishing.

## 4. Protected fields before/after

Every one of the 76 was hash-verified (`title`, `slug`, `cityId`, `ownerBusinessId`) both
immediately before the lifecycle call and immediately after — all 76 matched exactly except `slug`,
which is *allowed* to change from `null` to an assigned value (the same `assignSlugOnPublish()`
behavior `approvePlace()` already performs for any Place with no slug yet — not new behavior this
session introduced).

## 5. Final DB counts

```text
Place rows total:                    83 (unchanged — 0 CREATE, 0 DELETE)
PUBLISHED:                           81 (4 protected + 76 newly published + 1 seed)
PENDING:                              2 (the 2 CITY_BLOCKED, untouched)
active PLACE MigrationLineage:       82 (unchanged)
MediaAsset:                         159 (unchanged — 0 media/storage writes)
PlaceImage:                          39 (unchanged)
duplicate city-scoped slugs:          0
```

## 6. Public/canonical/search proof

Automated HTTP check, all 76 newly-published Places: **76/76 return 200, 76/76 have
`<link rel="canonical">` present, 0/76 are ID-based** (all resolve to their real slug).

Representative deep smoke (`«Трапеция»`, a newly-published skate/climbing Place): 0 console errors,
clean desktop and mobile (375×812) render, correct breadcrumb (Главная→Минск→...), correct
category/address/hours, no broken images (media policy is METADATA-only for these 76, so no cover
image is expected — none rendered a broken `<img>`, matching the same posture validated for Offers
in §7 of the Offer result doc).

Both `CITY_BLOCKED` Places (`be-english`, `shkola-arhitekturnogo-myshleniya-dlya-detej`) confirmed
**still 404** — correctly excluded, never touched.

## 7. Idempotency — precise rerun semantics

Reran the same publication route in commit mode a second time. The prior report labeled this
"76/76 `ALREADY_PUBLISHED_RESYNCED`, 0 writes" — that undersold what actually happens on rerun. No
new rerun was performed to correct this; the following is a read-only, code-level determination of
what the already-executed rerun did, based on the actual implementations of `syncPlaceCanonical()`
and `SearchIndexerService.upsertPlace()`:

```text
Place lifecycle DB writes:   0   — approvePlace() is never called on this path (status is already
                                    PUBLISHED, so the resume branch skips straight to resync); 0
                                    status/city/ownership/slug changes, confirmed by the hash check
                                    matching the manifest for all 76.
Place canonical DB writes:  76   — syncPlaceCanonical() calls prisma.place.update() unconditionally,
                                    with no before/after value comparison. It ran once per Place on
                                    the rerun. The written seoCanonicalUrl value is byte-identical to
                                    what was already there, but Place.updatedAt (a Prisma @updatedAt
                                    field) is bumped by every such UPDATE regardless of value change.
Place search-index writes:  76   — SearchIndexerService.upsertPlace() calls
                                    prisma.searchDocument.upsert() unconditionally (no diff check).
                                    Same effect: SearchDocument content is unchanged, but its own
                                    @updatedAt timestamp is bumped by every call.
Place media/storage writes:  0
```

Correct classification per this session's own taxonomy: **not** `ALREADY_PUBLISHED_NOOP` (that
label requires canonical and search writes to both be zero, which they are not) — the accurate
label is **`ALREADY_PUBLISHED_CANONICAL_AND_INDEX_RESYNC`**: zero lifecycle/content changes, but
non-zero canonical-table and search-index writes (value-neutral, timestamp-only) on every rerun.
This is a real, if harmless, consequence of calling `approvePlace()`'s downstream sync helpers
unconditionally on every resume check, not something specific to a "broken" idempotency — the
*effective* state (what a reader of the row or the search index sees) never changes between runs.

## 8. Production execution

Not started (out of scope, no production writes performed anywhere in this session, per explicit
instruction).

## 9. Integrated RC revalidation

This entire proof was generated against this worktree in isolation. Per the checklist's
`BROWSER_PROOF_REVALIDATION_REQUIRED_ON_INTEGRATED_RC` note, this should be re-checked once merged
into a single integrated RC worktree alongside Articles/Users/UAT, Events, and Routes.
