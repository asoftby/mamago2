# Cumulative DB audit + idempotency — Places & Offers — 2026-07-28

## Before/after (session start → now)

```text
Place rows:                    83 → 83   (0 CREATE, 0 DELETE)
Offer rows:                    63 → 63   (0 CREATE, 0 DELETE)
Place PUBLISHED:                5 →  5   (unchanged — no publish action taken)
Offer PUBLISHED:                0 →  0   (unchanged — no publish action taken)
active PLACE MigrationLineage: 82 → 82   (unchanged)
active OFFER MigrationLineage: 63 → 63   (unchanged)
MediaAsset total:             159 → 159  (unchanged — no media writes this session)
PlaceImage total:               39 → 39  (unchanged)
Business count:                42 → 42  (unchanged)
City count:                     5 →  5  (unchanged)
```

**The only DB write performed this session was the 63-row `Offer.cityId` backfill** (null →
`place.cityId`, evidence-based, CAS-guarded, fully reversible-in-spirit since the value is
deterministically re-derivable). Every other row count above is byte-identical to session start.

## Invariant checklist

```text
unexpected Place CREATE:            0
unexpected Offer CREATE:            0
DELETE (either entity):             0
duplicate source keys (Place):      0
duplicate source keys (Offer):      0
duplicate slugs (Place, city-scoped): 0
duplicate slugs (Offer, city-scoped): 0 (moot — all Offer slugs still null)
orphan media links:                 0
unexpected ownership changes:       0
unexpected lifecycle/status changes: 0 (only field touched was Offer.cityId)
forbidden table changes:            0
production writes:                  0
```

## Idempotency reruns

**Place** — reran the full 82-key read-only source preview a second time
(`place-source-preview-rerun-2026-07-28.json`): identical result, `78 SKIP_UNCHANGED / 4
UPDATE_CONFLICT / 0 CREATE` — deterministic.

**Offer** — reran the `cityId` backfill script a second time immediately after the first:
`0 eligible / 0 applied` — deterministic, no repeated writes, no lifecycle/city/ownership loss.

The broader "safe canonical Offer 63" batch/golden execution itself was **not rerun** this session
(explicitly marked "должен запускаться" once, already closed 2026-07-22 with its own immutable
manifest hashes and a clean `63 SKIP_UNCHANGED` rerun on record) — rerunning it again today would
duplicate an already-proven result rather than add new evidence.

Excluded records (Offer class H `28`, class I `8`) have a deterministic non-write outcome by
construction: neither is persisted anywhere in the local DB (no `MigrationLineage`, no `Place`/`Offer`
row), so there is nothing for any rerun to touch or regress.
