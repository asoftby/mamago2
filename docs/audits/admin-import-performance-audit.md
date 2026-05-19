# Phase 6G: Admin Import Page Performance Audit

**Date:** 2026-05-19
**Files changed:** `src/app/admin/import/review/page.tsx`, `src/app/admin/import/runs/page.tsx`
**Symptom:** Admin Import pages load in ~30+ seconds (local/dev environment).

---

## Pages audited

| Page | Route | Server data functions |
|------|-------|-----------------------|
| Dashboard | `/admin/import` | `getDashboardData` |
| Runs | `/admin/import/runs` | `getRuns`, `getSources` |
| Review queue | `/admin/import/review` | `getQueueStats`, `getImportedObjects`, `getSources` |
| Sources | `/admin/import/sources` | `listImportSources` |

All pages use `export const dynamic = "force-dynamic"` and are pure server components — no client-side data fetching triggered on load.

---

## Root cause: two unbounded operations

### B1 — `getQueueStats` unbounded `findMany` + reconciliation · CRITICAL (fixed)

**File:** `src/app/admin/import/review/page.tsx`, `getQueueStats()`

**Pre-fix code:**

```ts
// 1. Fetch ALL linked ImportedRecords (no limit)
const linkedRecords = await db.importedRecord.findMany({
  where: {
    OR: [
      { publishedPlaceId: { not: null } },
      { publishedActivityId: { not: null } },
    ],
  },
  select: { id, publishedPlaceId, publishedActivityId, reviewDecision, applyResult },
});

// 2. Reconcile: look up every referenced Place and Activity by id
//    → up to 2 more queries (place.findMany + activity.findMany)
//    → up to N individual importedRecord.update() for stale links
const reconciledLinkedRecords = await reconcileImportedRecordLinks(linkedRecords, prismaBase);

// 3. Four COUNT queries (concurrent)
const [total, pending, inProgress, completed] = await Promise.all([...]);

// linked = count after reconciliation
```

**Why this is slow:**

- `ImportedRecord` has no index on `publishedPlaceId` or `publishedActivityId`. The `findMany` performs a **full table scan** over potentially 100k+ rows, transferring all JSON fields (`normalizedData`, `matchCandidates`, `reviewDecision`, `applyResult`) across the DB connection.
- `reconcileImportedRecordLinks` then issues `place.findMany({ id: { in: [...] } })` and `activity.findMany({ id: { in: [...] } })` with potentially thousands of IDs.
- If any links are stale, each stale record triggers an individual `importedRecord.update()` — N writes during page load.
- All of this runs **sequentially** before the 4 count queries start.

On a table with 50 000+ records, this path alone can take 20–40 seconds.

**Fix:** Replace the unbounded `findMany` + reconciliation with a single parallel `count` query:

```ts
const [total, pending, inProgress, completed, linked] = await Promise.all([
  db.importedRecord.count({ where: {} }),
  db.importedRecord.count({ where: { reviewStatus: "PENDING" } }),
  db.importedRecord.count({ where: { OR: [{ reviewStatus: "IN_REVIEW" }, ...] } }),
  db.importedRecord.count({ where: { OR: [{ reviewStatus: { in: ["APPROVED", ...] } }, ...] } }),
  db.importedRecord.count({
    where: { OR: [{ publishedPlaceId: { not: null } }, { publishedActivityId: { not: null } }] },
  }),
]);
return { total, pending, inProgress, completed, linked };
```

**Trade-off:** The `linked` count now includes records that point to deleted/archived Places or Activities (stale links). Previously it showed only currently-active links after reconciliation. The over-count is acceptable for a dashboard stat card — exact accuracy here is less important than a responsive page. Reconciliation still runs in `getImportedObjects` when the filtered record list is loaded (max 100 records at a time).

**Query reduction:** 3+ queries (sequential) + N writes → **5 COUNT queries (concurrent)**.

---

### B2 — `getRuns` includes all `ImportedRecord` rows per run · HIGH (fixed)

**File:** `src/app/admin/import/runs/page.tsx`, `getRuns()`

**Pre-fix code:**

```ts
return db.importRun.findMany({
  where: { ... },
  orderBy: { createdAt: "desc" },
  take: 100,
  include: {
    source: { select: { id, name, slug, defaultEntity, isActive, archivedAt } },
    records: { select: { applyResult: true, reviewStatus: true } },  // ← ALL records per run
  },
});
```

The `records` include loads every `ImportedRecord` associated with each run. A run can have thousands of records. At 100 runs × N records each, this is potentially hundreds of thousands of rows loaded into Node.js memory, only to be filtered in JS:

```ts
const appliedCount      = run.records.filter(r => r.applyResult !== null).length;
const pendingReviewCount = run.records.filter(r => r.reviewStatus === "PENDING").length;
```

**Fix:** Remove the `records` include. Add `getRunRecordCounts()` which uses two `groupBy` queries (the same pattern the dashboard already uses for its 8 recent runs):

```ts
async function getRunRecordCounts(runIds: string[]) {
  const [pendingGroups, appliedGroups] = await Promise.all([
    db.importedRecord.groupBy({
      by: ["runId"],
      where: { runId: { in: runIds }, reviewStatus: "PENDING" },
      _count: { _all: true },
    }),
    db.importedRecord.groupBy({
      by: ["runId"],
      where: { runId: { in: runIds }, applyResult: { not: Prisma.DbNull } },
      _count: { _all: true },
    }),
  ]);
  // build pendingByRunId and appliedByRunId Maps
}
```

The render uses `pendingByRunId.get(run.id) ?? 0` and `appliedByRunId.get(run.id) ?? 0`.

**Query reduction:** 1 query loading O(runs × records) rows → **3 queries** (runs + 2 groupBy counts).
`@@index([runId])` exists on `ImportedRecord` — the groupBy queries are index-scans, not table scans.

---

## Other pages: not primary bottlenecks

### Dashboard (`/admin/import`)

Already well-structured: 8-run `take` limit, concurrent `Promise.all` for all counts, `groupBy` for per-run stats. No change needed.

### Sources (`/admin/import/sources`)

Fetches all sources including archived and inactive in one query. `ImportSource` is an admin-configured table (expected row count: tens to low hundreds). Full scan is negligible. No change needed.

### Review detail (`/admin/import/review/[id]`)

Makes 4–6 sequential DB round-trips but they are all narrow point lookups by primary key or indexed foreign key. Not the cause of the 30-second load (that page is per-record, not bulk).

---

## Query inventory after fixes

### `/admin/import/review` (review queue page)

| # | Query | When |
|---|-------|------|
| 1–5 | `importedRecord.count(×5)` | Always, concurrent |
| 6 | `importedRecord.findMany({ take: 100 })` | Always |
| 7 | `place.findMany({ id: { in: [...] } })` | If any of the 100 records link a Place |
| 8 | `activity.findMany({ id: { in: [...] } })` | If any of the 100 records link an Activity |
| 9–N | `importedRecord.update()` per stale record | Only if stale links found in the 100 records |
| +1 | `importSource.findMany()` | Always (concurrent with #6) |

Sequential depth: counts (1 round-trip) → records + sources (1 round-trip) → optional reconciliation writes.

### `/admin/import/runs` (runs list page)

| # | Query | When |
|---|-------|------|
| 1 | `importRun.findMany({ take: 100 })` | Always (concurrent with #2) |
| 2 | `importSource.findMany()` | Always (concurrent with #1) |
| 3–4 | `importedRecord.groupBy(×2)` | After runs loaded, concurrent |

Sequential depth: 2 round-trips total.

---

## Schema observations (no migration in this phase)

| Missing index | Benefit | Risk of adding |
|---------------|---------|----------------|
| `@@index([publishedPlaceId])` | Speed up the `linked` count query | `CREATE INDEX` locks table; safe on small tables |
| `@@index([publishedActivityId])` | Same | Same |
| `@@index([runId, reviewStatus])` | Composite index for `groupBy` pending query | Additive, low risk |

The existing `@@index([runId])` already covers the groupBy filter on `runId`. A composite `(runId, reviewStatus)` would further avoid a post-index filter step. These are recommended for a follow-up migration when table sizes are known.

---

## Transaction correctness

No writes were moved or removed. `reconcileImportedRecordLinks` is still called from `getImportedObjects` (max 100 records, bounded). The stale-link healing still happens — just not for the entire table on every page open.

---

## What was intentionally not changed

| Area | Reason |
|------|--------|
| `getImportedObjects` reconciliation | Bounded by `take: 100`; correctness depends on it |
| Dashboard `getDashboardData` | Already uses groupBy; not a bottleneck |
| Sources page | Table is small by design |
| Review detail page | Per-record lookups; not a bulk-load issue |
| Import business logic | Out of scope |
| Response shapes / admin UI | Unchanged |
