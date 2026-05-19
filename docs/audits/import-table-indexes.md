# Phase 6G-1: ImportedRecord Review Indexes

**Date:** 2026-05-19
**Files changed:**
- `prisma/schema.prisma` (3 new `@@index` directives)
- `prisma/migrations/20260519120000_add_imported_record_review_indexes/migration.sql`

**Preceded by:** Phase 6G (`docs/audits/admin-import-performance-audit.md`)

---

## Why these indexes

Phase 6G replaced the Admin Import review page's unbounded `findMany` + reconciliation with
`COUNT` queries, and replaced the runs page's `records` include with `groupBy` counts.
The audit noted three missing indexes that leave those new queries doing full or near-full
table scans as the `ImportedRecord` table grows.

---

## Indexes added

### 1. `ImportedRecord_publishedPlaceId_idx`

```sql
CREATE INDEX IF NOT EXISTS "ImportedRecord_publishedPlaceId_idx"
  ON "public"."ImportedRecord" ("publishedPlaceId");
```

**Query it covers** (review queue page — `getQueueStats`):

```ts
db.importedRecord.count({
  where: {
    OR: [
      { publishedPlaceId: { not: null } },
      { publishedActivityId: { not: null } },
    ],
  },
})
```

PostgreSQL can resolve the `OR` as a bitmap-OR of two index scans instead of a full table
scan. The index is sparse-friendly: most records have `publishedPlaceId = NULL`, so only
the non-null minority is indexed in the B-tree leaf pages.

### 2. `ImportedRecord_publishedActivityId_idx`

```sql
CREATE INDEX IF NOT EXISTS "ImportedRecord_publishedActivityId_idx"
  ON "public"."ImportedRecord" ("publishedActivityId");
```

Same query as above, other arm of the `OR`.

### 3. `ImportedRecord_runId_reviewStatus_idx`

```sql
CREATE INDEX IF NOT EXISTS "ImportedRecord_runId_reviewStatus_idx"
  ON "public"."ImportedRecord" ("runId", "reviewStatus");
```

**Query it covers** (runs page and dashboard — `groupBy` pending count):

```ts
db.importedRecord.groupBy({
  by: ["runId"],
  where: { runId: { in: runIds }, reviewStatus: "PENDING" },
  _count: { _all: true },
})
```

The composite index lets PostgreSQL resolve `runId IN (...)` and `reviewStatus = 'PENDING'`
in a single index scan rather than a `runId` index scan followed by a heap-filter on
`reviewStatus`. For runs with many non-pending records this is the more selective path.

The existing `ImportedRecord_runId_idx` (single column) is not removed — it continues to
serve `WHERE runId = ?` lookups that don't filter by `reviewStatus` (e.g. run detail pages).

---

## Schema after this phase

```
@@index([sourceId, reviewStatus])   -- source-scoped review queries
@@index([sourceId, externalId])     -- dedup on import
@@index([contentHash])              -- content dedup
@@index([runId])                    -- run detail lookups
@@index([runId, reviewStatus])      -- NEW: per-run pending counts
@@index([publishedPlaceId])         -- NEW: linked-record stats
@@index([publishedActivityId])      -- NEW: linked-record stats
@@index([parseStatus])
@@index([normalizeStatus])
@@index([matchStatus])
```

---

## What was intentionally not changed

| Area | Reason |
|------|--------|
| Application logic | Index-only phase |
| `reconcileImportedRecordLinks` | Not in this phase's scope |
| Partial indexes | Prisma schema doesn't support them; could be added as a future raw migration |
| Other models | No performance need identified |
