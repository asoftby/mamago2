# P0 publication indexing race fix — 2026-07-29

Status: `RESOLVED LOCAL`; integrated RC revalidation required.

Branch/base/worktree: `fix/prelaunch-p0-route-search`, `edf8af6b`,
`/Users/shapovalovalexey/dev/mamago2-prelaunch-p0-route-search`.
Changed files: `SearchIndexQueue.ts`, `SearchIndexerService.ts`,
`moderation.service.ts` and their publication regression tests.

Root-cause sequence:

```text
PENDING row
  -> status update (extension dispatches unawaited early index)
  -> slug/city/canonical finalization (more extension dispatches)
  -> unordered search upserts; an early stale snapshot could finish last
```

Changed sequence:

```text
PENDING row
  -> lifecycle status write through prismaBase
  -> awaited slug/city/canonical finalization
  -> all extension writes serialized by entity key
  -> one strict final upsert queued last and awaited
  -> caller success (or explicit indexing rejection)
```

`SearchIndexQueue` orders writes for the same `(entityType, entityId)` while
unrelated entities remain concurrent. The strict final Event/Place/Offer
methods propagate failures; retry is the same unique-key upsert and remains
idempotent.

Proof:

- delayed-early-index unit regression proves it cannot beat the final write;
- failure propagation and deterministic retry unit regressions pass;
- real local ephemeral fixture test passed for Event, Place and Offer;
- final documents were published, slug-based, unique, and Offer canonical
  finalization completed before return; Event/Offer paths use the final city,
  all documents use final title/status, and fixtures were removed in `finally`.

Fixture-only local deltas returned to baseline after cleanup. Existing
content/lifecycle DB writes: 0. Fixture writes: temporary Event, Place, Offer
and required ownership rows plus their lifecycle/search rows, all deleted by
`finally`. Production writes: 0. Media/storage writes: 0. Search writes were
bounded to temporary fixture upserts/deletes.

Unrelated Route runtime findings remain `ROUTE_RATINGS_PARAMS_NOT_AWAITED —
OPEN P1` and `MISSING_FAVICON_ASSET — OPEN P2`.

`BROWSER_PROOF_REVALIDATION_REQUIRED_ON_INTEGRATED_RC`
