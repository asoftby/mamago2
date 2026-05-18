# Event PATCH Hot Path Fix

Date: 2026-05-19
Scope: `src/app/api/business/events/[id]/route.ts`
Follows: Phase 6A audit (`docs/audits/save-flows-revalidate-refresh-audit.md`)

## What was expensive on every draft PATCH

| Branch | Calls | DB queries | Notes |
|---|---|---|---|
| Always (unconditional) | `getActivityOccurrenceDebugState` before response | 4 parallel queries | `activity` + 3 `activitySession` aggregates |
| When `activitySessionsNeedResync` | `getActivityOccurrenceDebugState` before sync | 4 | Same 4-query fan-out |
| When `activitySessionsNeedResync` | `getActivityOccurrenceDebugState` after sync | 4 | Same 4-query fan-out |
| Always | `console.info("[event-patch-timing/debug]"...)` | 0 | Logging overhead, unguarded |

On a plain text/description draft save that does not touch schedule: **4 extra DB queries fired unconditionally** before building the response. On a schedule-changing save: **12 extra DB queries** (4 + 4 + 4) for debug state alone.

## Guards added / strengthened

### `getActivityOccurrenceDebugState` before response (line ~699)

**Before:**
```typescript
const beforeResponseState = await getActivityOccurrenceDebugState(saved.id); // always
const responsePayload = { ... };
console.info("[event-patch-debug] before response", { ..., beforeResponseState });
```

**After:**
```typescript
const responsePayload = { ... };
if (isServerSavePerfEnabled()) {
  const beforeResponseState = await getActivityOccurrenceDebugState(saved.id);
  console.info("[event-patch-debug] before response", { ..., beforeResponseState });
}
```

### `getActivityOccurrenceDebugState` around session sync

**Before:** called unconditionally inside `if (activitySessionsNeedResync)` both before and after `replaceActivitySessionsFromScheduleJson`.

**After:** both calls gated behind `isServerSavePerfEnabled()`. The actual sync work (`replaceActivitySessionsFromScheduleJson`, `syncActivityNextOccurrenceAt`) is unchanged.

### Timing `console.info` logs

All `[event-patch-timing]` and `[event-patch-debug]` logs were previously unconditional. Now gated behind `isServerSavePerfEnabled()`:
- `schedule-compare` log
- `activity-update` log + its `performance.now()` capture
- `activity-sessions-sync` log
- `next-occurrence-sync` log
- `revalidate` log

## What was not touched intentionally

- `replaceActivitySessionsFromScheduleJson` — still called when `activitySessionsNeedResync` is true; no change to session replacement logic.
- `syncActivityNextOccurrenceAt` — still called after session sync; no change.
- `activitySessionsNeedResync` guard logic — fingerprint comparison is unchanged.
- `activityGalleryMatchesIncomingMediaIds` / `replaceActivityGalleryFromMediaIds` — gallery guards and replacement are unchanged.
- `syncEventVenueAndActivityCity` — venue-change guard is unchanged.
- `revalidateEventMutationPaths` / `resolveEventPatchRevalidateScope` — revalidation logic untouched.
- Publish / submit / moderation endpoints — not in scope.
- Response JSON shape — identical.

## `isServerSavePerfEnabled` behavior

Defined in `src/server/utils/requestPerf.ts`:
```typescript
const SERVER_DEBUG_SAVE_PERF =
  process.env.NODE_ENV !== "production" || process.env.DEBUG_SAVE_PERF === "true";
```

- In **production**: debug reads are skipped unless `DEBUG_SAVE_PERF=true` is set.
- In **development / test**: debug reads still run, so local debugging is preserved.

## Remaining risks

- None of the actual save logic was changed, so correctness risk is minimal.
- Debug state is no longer read on every prod request; if a prod occurrence-sync bug surfaces it will need `DEBUG_SAVE_PERF=true` to reproduce the before/after state snapshots.
- The `replaceActivitySessionsFromScheduleJson` + `syncActivityNextOccurrenceAt` are still `deleteMany + createMany` — this is Phase 6D territory, not changed here.

## What comes next

- **Phase 6C** — narrow `business-save` revalidation: skip `/business/events` list invalidation for editor-only field changes (title/description/price/format).
- **Phase 6D** — diff-based session and gallery sync; place subcategory diff guard.
- **Phase 6E** — route stop fingerprint short-circuit.
