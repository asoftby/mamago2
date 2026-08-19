import assert from "node:assert/strict";
import type { MigrationLineage } from "@prisma/client";

import { classifyImportedTargetUpdateSafety } from "./classifyImportedTargetUpdateSafety";

function lineage(overrides: Partial<MigrationLineage> = {}): MigrationLineage {
  return {
    id: "lin-1",
    sourceId: "src-1",
    recordId: "rec-1",
    runId: "run-1",
    sourceEntityType: "wordpress-db:events",
    sourceExternalId: "1",
    sourceStableKey: "wordpress-db:events:1",
    sourceRecordKey: "wordpress-db:events:1",
    targetType: "ACTIVITY",
    targetId: "act-1",
    targetRole: "primary",
    targetNaturalKey: "act-1",
    lastSourceHash: "hash",
    lastPlanAction: "CREATE",
    isActive: true,
    lastSeenAt: new Date("2026-08-01T00:00:00.000Z"),
    lastImportedAt: new Date("2026-08-01T00:00:00.000Z"),
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    updatedAt: new Date("2026-08-01T00:00:00.000Z"),
    ...overrides,
  } as MigrationLineage;
}

assert.equal(
  classifyImportedTargetUpdateSafety({
    targetType: "ACTIVITY",
    sourceRecordKey: "wordpress-db:events:1",
    lineage: null,
    target: null,
  }).classification,
  "UPDATE_CONFLICT",
);

function conflictReason(input: Parameters<typeof classifyImportedTargetUpdateSafety>[0]): string | undefined {
  const result = classifyImportedTargetUpdateSafety(input);
  return result.classification === "UPDATE_CONFLICT" ? result.reason : undefined;
}

assert.equal(
  conflictReason({
    targetType: "ACTIVITY",
    sourceRecordKey: "wordpress-db:events:1",
    lineage: lineage({ targetId: null }),
    target: null,
  }),
  "TARGET_ID_MISSING",
);

assert.equal(
  conflictReason({
    targetType: "ACTIVITY",
    sourceRecordKey: "wordpress-db:events:1",
    lineage: lineage(),
    target: null,
  }),
  "TARGET_ROW_MISSING",
);

assert.equal(
  conflictReason({
    targetType: "ACTIVITY",
    sourceRecordKey: "wordpress-db:events:1",
    lineage: lineage({ lastImportedAt: null }),
    target: { id: "act-1", updatedAt: new Date("2026-08-01T00:00:00.000Z") },
  }),
  "LAST_IMPORTED_AT_UNKNOWN",
);

assert.equal(
  conflictReason({
    targetType: "ACTIVITY",
    sourceRecordKey: "wordpress-db:events:1",
    lineage: lineage(),
    target: { id: "act-1", updatedAt: new Date("2026-08-02T00:00:00.000Z") },
  }),
  "TARGET_MODIFIED_AFTER_IMPORT",
);

const safe = classifyImportedTargetUpdateSafety({
  targetType: "ACTIVITY",
  sourceRecordKey: "wordpress-db:events:1",
  lineage: lineage(),
  target: { id: "act-1", updatedAt: new Date("2026-08-01T00:00:00.000Z") },
});
assert.equal(safe.classification, "UPDATE_SAFE");
if (safe.classification === "UPDATE_SAFE") assert.equal(safe.targetId, "act-1");

const preserved = classifyImportedTargetUpdateSafety({
  targetType: "ROUTE",
  sourceRecordKey: "wordpress-db:routes:1",
  lineage: lineage({
    sourceRecordKey: "wordpress-db:routes:1",
    targetType: "ROUTE",
    targetId: "route-1",
  }),
  target: { id: "route-1", updatedAt: new Date("2026-07-31T00:00:00.000Z") },
});
assert.equal(preserved.classification, "UPDATE_SAFE");

console.log("classifyImportedTargetUpdateSafety tests: OK");
