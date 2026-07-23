import assert from "node:assert/strict";
import test from "node:test";

import { classifyTailReconciliation } from "./reconcileBusinessLinkedTail";
import type { PlaceCoverageBreakdown } from "./types";

function coverage(overrides: Partial<PlaceCoverageBreakdown> = {}): PlaceCoverageBreakdown {
  return { totalOwnedPlaces: 10, migratedPlaces: 10, missingPlaces: 0, missingPlacesBySourceStatus: {}, ...overrides };
}

test("no User lineage at all requires a founder decision, never guessed", () => {
  const verdict = classifyTailReconciliation(false, coverage(), true, false);
  assert.equal(verdict, "FOUNDER_DECISION_REQUIRED");
});

test("a migrated Place already owned by another Business is a conflict, never silently resolved", () => {
  const verdict = classifyTailReconciliation(true, coverage({ missingPlaces: 0 }), false, false);
  assert.equal(verdict, "CONFLICT");
});

test("full coverage with no conflict is a safe future candidate", () => {
  const verdict = classifyTailReconciliation(true, coverage({ totalOwnedPlaces: 5, migratedPlaces: 5, missingPlaces: 0 }), true, false);
  assert.equal(verdict, "SAFE_FUTURE_CANDIDATE");
});

test("every missing Place cleanly attributed to a source status (never attempted) is TARGET_PLACE_NOT_MIGRATED", () => {
  const cov = coverage({ totalOwnedPlaces: 214, migratedPlaces: 19, missingPlaces: 195, missingPlacesBySourceStatus: { unpublished: 187, draft: 8 } });
  const verdict = classifyTailReconciliation(true, cov, true, false);
  assert.equal(verdict, "TARGET_PLACE_NOT_MIGRATED");
});

test("a missing Place with real prior MigrationRecord history (attempted-and-failed) is ambiguous, not assumed clean", () => {
  const cov = coverage({ totalOwnedPlaces: 3, migratedPlaces: 2, missingPlaces: 1, missingPlacesBySourceStatus: { publish: 1 } });
  const verdict = classifyTailReconciliation(true, cov, true, true);
  assert.equal(verdict, "AMBIGUOUS");
});

test("a missing Place whose source status accounting doesn't add up is ambiguous, never guessed as safe", () => {
  const cov = coverage({ totalOwnedPlaces: 5, migratedPlaces: 3, missingPlaces: 2, missingPlacesBySourceStatus: { draft: 1 } });
  const verdict = classifyTailReconciliation(true, cov, true, false);
  assert.equal(verdict, "AMBIGUOUS");
});
