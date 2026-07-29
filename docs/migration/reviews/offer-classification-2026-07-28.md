# Offer production-readiness audit — 2026-07-28

## Live DB reconfirmation (not trusting the checklist's stated numbers blindly)

```text
Total Offer rows:                    63
Active OFFER MigrationLineage:       63
Duplicate sourceRecordKeys:          0
Duplicate Offer linkage:             0
Lineage rows with null targetId:     0
Duplicate city-scoped Offer slugs:   0 (moot — all 63 had slug: null before/after this session)
Offer.kind breakdown:                63 SERVICE
Offer.status breakdown:              63 DRAFT
```

**63/63 safe canonical scope reconfirmed intact today**, matching the prior session's closure
(commit `1fca8c8b`, 2026-07-22 — golden proof + Batch 1–4, each with an immutable manifest SHA-256,
final common rerun `63 SKIP_UNCHANGED / 0 CREATE / 0 UPDATE / 0 BLOCKED / 0 ERROR`). That session's
own text says explicitly **"Safe canonical OFFERS scope завершён и больше не должен запускаться"** —
so this session did not re-run the batch/golden execution (would violate "не повторять доказанные
проверки без новых изменений"); it only re-verified the live DB still matches that closure, which it
does exactly (63/63, 0 duplicates, 0 drift).

## Class H (28) / Class I (8) — carried forward, not re-derived

No bulk "discover all published Offer source records" tool exists in this codebase (confirmed: the
generic `migration:preview:wordpress-db` CLI's `--entity` flag only accepts
`article|place|event|route|all`, deliberately excluding `offer`; the WordPress adapter only exports a
single-key `fetchPublishedOfferEnvelopeBySourceRecordKey`, no bulk discovery function). Building one
now would be new architectural work, not proving-existing-data-correct work, and the historical
closure already computed and closed these two backlog buckets with cryptographic manifest proof.
Carried forward as-is from `prelaunch-checklist.md`'s existing record:

```text
class H: 28 — missing required Place relation (collapseOfferPlaceRelations: MISSING_PLACE_RELATION)
class I: 8  — noncanonical alias (source post_type "offers", not hb-programs/services)
```

Neither blocks the safe-63 scope. Local DB has zero trace of these 28+8 (by design — blocked
candidates are never persisted, not even as `MigrationRecord` rows, since only `LINKED` outcomes are
recorded) — they exist only as the prior session's already-closed read-only analysis, correctly
left as documented backlog per this closure's own rules ("не создавать фиктивный Place... Оставить
documented backlog").

## New finding #1 (fixed this session): `OfferCommitWriter` silently dropped `cityId`

`buildOfferCreateDraft.ts` resolves and *requires* `context.cityId` (`MISSING_CITY` blocks the draft
otherwise) — but places the resolved value at `draft.ownership.cityId`, a nested field
`OfferCommitWriter.createOfferFromDraft()` never read. The `Offer.create({ data })` payload never
included `cityId` at all, despite every one of the 63 rows having had a fully resolved, validated
city at draft-build time. Result: **all 63 Offers had `cityId: null` in the live DB**, even though
their linked `Place.cityId` was always correct — this is not "missing evidence," it's evidence that
was computed and then thrown away by the writer.

**Fixed**: [`OfferCommitWriter.ts`](../../../src/lib/migration/commit/offer/OfferCommitWriter.ts) now
includes `cityId: draft.ownership.cityId` in the create payload. Added
`OfferCommitWriter.test.ts` (new file — none existed before) with a regression test asserting
`cityId` is written from `draft.ownership.cityId`. All existing Offer migration tests (`offerVerticalSlice`,
`collapseOfferPlaceRelations`, `offerWhitespaceRemediation`, `offerMapping`, `normalizeOffer`) still
pass.

**Backfilled** the 63 already-created rows: `Offer.cityId = Offer.place.cityId` for all 63 (100%
eligible — every linked Place has a real `cityId`, confirmed before running). One-off scoped script,
CAS-guarded per row (`status`/`placeId`/`updatedAt` must match the just-read snapshot or the row is
skipped, never force-written), stop-on-first-error, before/after assertion on every protected field
(`status`, `placeId`, `slug`, `title` — all confirmed byte-identical; only `cityId` changed).
Result: **63/63 applied, 0 skipped**. Immediate rerun of the same script: **0 eligible, 0 writes** —
idempotent. Full DB dump: [`offer-db-baseline-2026-07-28.json`](./offer-db-baseline-2026-07-28.json).

This is a pure data-correctness fix (filling a null with an unambiguous, already-known-correct
value derived from the Offer's own required Place relation) — it does not touch `status`, does not
publish anything, does not affect public visibility (all 63 remain `DRAFT`, still not publicly
reachable either way).

## New finding #2 (not fixed — structural/process gap, flagging for a decision)

All 63 Offers are `status: DRAFT`. The existing admin moderation function,
`approveOffer()` (`src/server/services/moderation.service.ts:447`), **only accepts a
`PENDING → PUBLISHED` transition** (`throw new Error("Cannot approve from status: ${offer.status}")`
otherwise) — there is currently no recorded "submit DRAFT → PENDING" step these 63 ever went
through, because they were created directly by the migration writer, not through the normal
Business-cabinet flow. Separately, the Business-cabinet PATCH endpoint
(`src/app/api/business/offers/[id]/route.ts`) *can* set `status` directly to `PUBLISHED` for
privileged roles (`canPublishContentDirectly`), and correctly triggers `ensurePublishedOfferHasSlug`
(slug + canonical assignment) as a side effect — so a technical path to publish does exist, just not
through the moderation-queue function. **Whether/how to move these 63 from DRAFT toward publication
is the same class of decision as the 78 pending Places** (see `place-classification-2026-07-28.md`)
— a product/content decision, not a migration-data-integrity one. Not done unilaterally in this
session.

## Classification

| Classification | Count | Notes |
| --- | --- | --- |
| `READY_NOOP` (content/relation/city, post-fix) | 63 | Place relation, ownership-derived city (now fixed+backfilled), no duplicates. Still `DRAFT`, still no slug/canonical (both depend on the publish step above, not attempted here). |
| `EXCLUDED_CLASS_H` | 28 | Missing required Place relation — carried forward from prior session's closed analysis, not re-derived. |
| `EXCLUDED_CLASS_I` | 8 | Noncanonical `offers` source alias — carried forward, same as above. |
| `PLACE_RELATION_DRIFT` / `CITY_SCOPE_DRIFT` | 0 | 0 mismatches between `Offer.placeId`'s Place and `Offer.cityId` after the backfill above. |
| `MEDIA_DRIFT` | see media manifest doc | 0/63 have any cover/gallery image — separate finding, not drift (never implemented, not a regression). |
| `SOURCE_UNPUBLISHED` / `BLOCKED_AMBIGUOUS` | 0 | Not applicable to the already-closed safe-63 scope. |
