import assert from "node:assert/strict";
import {
  conflictsForScenarioItems,
  effectiveScenarioItems,
  isScenarioDraftDirty,
  restoreScenarioDraft,
  scenarioDraftReducer,
  serializeScenarioDraft,
  suitableReplacementCandidates,
  unresolvedScenarioConflicts,
  type ScenarioClientItem,
  type ScenarioDraftState,
  type ScenarioReplacementCandidate,
} from "./scenarioDraft";

const iso = (hour: number) => `2026-09-01T${String(hour).padStart(2, "0")}:00:00.000Z`;
const item = (planItemId: string, activityId: string, start: number, end: number): ScenarioClientItem => ({
  planItemId, activityId, activitySessionId: null, title: activityId, coverImageUrl: null, href: null,
  startsAt: iso(start), endsAt: iso(end), durationMinutes: (end - start) * 60,
  schedulingKind: "SLOT", canReschedule: false,
  priceLabel: null, addressLabel: null, isBooked: false,
});
const candidate = (activityId: string, start: number, end: number, kind: "SLOT" | "WINDOW" | "UNKNOWN" = "SLOT"): ScenarioReplacementCandidate => ({
  activityId, activitySessionId: null, title: activityId, coverImageUrl: null, href: null,
  startsAt: iso(start), endsAt: iso(end), durationMinutes: (end - start) * 60,
  schedulingKind: kind, canReschedule: false,
  priceLabel: null, addressLabel: null, isBooked: false,
});

const original = [item("a", "A", 9, 14), item("b", "B", 10, 11), item("c", "C", 12, 13)];
const initial = (): ScenarioDraftState => ({ original, originalAcceptedConflictKeys: [], changes: {}, acceptedConflictKeys: [] });

// Replacement and deterministic undo always return directly to original.
let state = scenarioDraftReducer(initial(), { type: "replace", planItemId: "b", replacement: candidate("D", 15, 16) });
assert.equal(isScenarioDraftDirty(state), true);
assert.equal(effectiveScenarioItems(state)[1]?.activityId, "D");
state = scenarioDraftReducer(state, { type: "replace", planItemId: "b", replacement: candidate("E", 16, 17) });
state = scenarioDraftReducer(state, { type: "revert", planItemId: "b" });
assert.deepEqual(effectiveScenarioItems(state), original);

// Remove and undo.
state = scenarioDraftReducer(initial(), { type: "remove", planItemId: "b" });
assert.deepEqual(effectiveScenarioItems(state).map((x) => x.planItemId), ["a", "c"]);
state = scenarioDraftReducer(state, { type: "revert", planItemId: "b" });
assert.deepEqual(effectiveScenarioItems(state), original);

// Pair-specific keep leaves physical conflicts intact and isolates A↔B from A↔C.
state = initial();
const conflicts = conflictsForScenarioItems(original);
assert.equal(conflicts.length, 2);
state = scenarioDraftReducer(state, { type: "keep", conflictKey: conflicts[0]!.key });
assert.equal(conflictsForScenarioItems(effectiveScenarioItems(state)).length, 2);
assert.equal(unresolvedScenarioConflicts(state).length, 1);

// Replacement changes participant identity, so old suppression is pruned and cannot suppress A↔D.
const acceptedBefore = state.acceptedConflictKeys[0]!;
const replacedId = conflicts[0]!.itemIds.find((id) => id !== "a")!;
state = scenarioDraftReducer(state, {
  type: "replace",
  planItemId: replacedId,
  replacement: candidate("D", 10, 11),
});
assert.equal(state.acceptedConflictKeys.includes(acceptedBefore), false);
assert.equal(unresolvedScenarioConflicts(state).length, 2);

// Candidate filtering excludes UNKNOWN and duplicate Activity, while candidates that
// create a new conflict remain selectable but rank after conflict-free options.
state = scenarioDraftReducer(initial(), { type: "replace", planItemId: "b", replacement: candidate("D", 15, 16) });
const suitable = suitableReplacementCandidates({
  state,
  replacingPlanItemId: "c",
  candidates: [
    candidate("F", 16, 17),
    candidate("G", 13, 15), // touches A's 14 boundary only after 13–15: overlaps A until 14
    candidate("U", 16, 17, "UNKNOWN"),
    candidate("D", 16, 17),
  ],
});
assert.deepEqual(suitable.map((x) => x.activityId), ["F", "G"]);

state = scenarioDraftReducer(state, { type: "replace", planItemId: "c", replacement: suitable[1]! });
assert.ok(
  unresolvedScenarioConflicts(state).some((conflict) => conflict.itemIds.includes("c")),
  "a selected replacement may create a new locally recalculated conflict",
);

// Storage roundtrip; malformed/stale item references are rejected.
const restored = restoreScenarioDraft(original, serializeScenarioDraft(state));
assert.deepEqual(restored?.changes, state.changes);
assert.equal(restoreScenarioDraft(original, JSON.stringify({ changes: { missing: { state: "REMOVED" } }, acceptedConflictKeys: [] })), null);

// Continue restores the complete draft acceptance set, including Undo Keep.
const acceptedInitial: ScenarioDraftState = {
  original,
  originalAcceptedConflictKeys: [conflicts[0]!.key],
  changes: {},
  acceptedConflictKeys: [conflicts[0]!.key],
};
const unkeptDraft = scenarioDraftReducer(acceptedInitial, { type: "unkeep", conflictKey: conflicts[0]!.key });
const restoredUnkeep = restoreScenarioDraft(
  original,
  serializeScenarioDraft(unkeptDraft),
  acceptedInitial.originalAcceptedConflictKeys,
)!;
const continuedUnkeep = scenarioDraftReducer(acceptedInitial, { type: "restoreDraft", draft: restoredUnkeep });
assert.deepEqual(continuedUnkeep.acceptedConflictKeys, []);
assert.equal(isScenarioDraftDirty(continuedUnkeep), true);

console.log("scenarioDraft tests: OK");
