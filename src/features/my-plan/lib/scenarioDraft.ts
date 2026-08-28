import { detectScenarioConflicts, type ScenarioConflict } from "./detectScenarioConflicts";
import type { ScenarioSchedulingKind } from "./scenarioScheduling";

export type ScenarioClientItem = {
  planItemId: string;
  activityId: string | null;
  activitySessionId: string | null;
  title: string;
  coverImageUrl: string | null;
  href: string | null;
  startsAt: string | null;
  endsAt: string | null;
  durationMinutes: number | null;
  schedulingKind: ScenarioSchedulingKind;
  canReschedule: boolean;
  /** Display-only enrichment — never read by conflict detection or the
   * reducer, just carried through replace/save so the redesigned card can
   * render it. Null/false when the source has nothing real to show. */
  priceLabel: string | null;
  addressLabel: string | null;
  isBooked: boolean;
};

export type ScenarioReplacementCandidate = Omit<ScenarioClientItem, "planItemId">;

export type ScenarioDraftChange =
  | { state: "REPLACED"; replacement: ScenarioReplacementCandidate }
  | { state: "REMOVED" };

export type ScenarioDraftState = {
  original: ScenarioClientItem[];
  originalAcceptedConflictKeys: string[];
  changes: Record<string, ScenarioDraftChange>;
  acceptedConflictKeys: string[];
};

export type ScenarioDraftAction =
  | { type: "replace"; planItemId: string; replacement: ScenarioReplacementCandidate }
  | { type: "remove"; planItemId: string }
  | { type: "revert"; planItemId: string }
  | { type: "keep"; conflictKey: string }
  | { type: "unkeep"; conflictKey: string }
  | { type: "revertAll" }
  | { type: "restoreDraft"; draft: ScenarioDraftState }
  | { type: "resetCanonical"; items: ScenarioClientItem[]; acceptedConflictKeys: string[] };

export function effectiveScenarioItems(state: ScenarioDraftState): ScenarioClientItem[] {
  return state.original.flatMap((item) => {
    const change = state.changes[item.planItemId];
    if (change?.state === "REMOVED") return [];
    if (change?.state === "REPLACED") {
      return [{ ...change.replacement, planItemId: item.planItemId }];
    }
    return [item];
  });
}

export function conflictsForScenarioItems(items: ScenarioClientItem[]): ScenarioConflict[] {
  return detectScenarioConflicts(items.map((item) => ({
    id: item.planItemId,
    contentId: item.activityId,
    scheduling: {
      kind: item.schedulingKind,
      startsAt: item.startsAt ? new Date(item.startsAt) : null,
      endsAt: item.endsAt ? new Date(item.endsAt) : null,
      durationMinutes: item.durationMinutes,
      canReschedule: item.canReschedule,
    },
  })));
}

export function unresolvedScenarioConflicts(state: ScenarioDraftState): ScenarioConflict[] {
  const accepted = new Set(state.acceptedConflictKeys);
  return conflictsForScenarioItems(effectiveScenarioItems(state)).filter(
    (conflict) => !accepted.has(conflict.key),
  );
}

function pruneAccepted(state: ScenarioDraftState): ScenarioDraftState {
  const activeKeys = new Set(conflictsForScenarioItems(effectiveScenarioItems(state)).map((c) => c.key));
  return {
    ...state,
    acceptedConflictKeys: state.acceptedConflictKeys.filter((key) => activeKeys.has(key)),
  };
}

export function scenarioDraftReducer(
  state: ScenarioDraftState,
  action: ScenarioDraftAction,
): ScenarioDraftState {
  if (action.type === "restoreDraft") {
    return {
      ...state,
      changes: action.draft.changes,
      acceptedConflictKeys: [...action.draft.acceptedConflictKeys].sort(),
    };
  }
  if (action.type === "revertAll") {
    return {
      original: state.original,
      originalAcceptedConflictKeys: state.originalAcceptedConflictKeys,
      changes: {},
      acceptedConflictKeys: state.originalAcceptedConflictKeys,
    };
  }
  if (action.type === "resetCanonical") {
    return {
      original: action.items,
      originalAcceptedConflictKeys: [...action.acceptedConflictKeys].sort(),
      changes: {},
      acceptedConflictKeys: [...action.acceptedConflictKeys].sort(),
    };
  }
  if (action.type === "keep") {
    return state.acceptedConflictKeys.includes(action.conflictKey)
      ? state
      : { ...state, acceptedConflictKeys: [...state.acceptedConflictKeys, action.conflictKey].sort() };
  }
  if (action.type === "unkeep") {
    return { ...state, acceptedConflictKeys: state.acceptedConflictKeys.filter((k) => k !== action.conflictKey) };
  }

  const changes = { ...state.changes };
  if (action.type === "replace") changes[action.planItemId] = { state: "REPLACED", replacement: action.replacement };
  if (action.type === "remove") changes[action.planItemId] = { state: "REMOVED" };
  if (action.type === "revert") delete changes[action.planItemId];
  return pruneAccepted({ ...state, changes });
}

export function isScenarioDraftDirty(state: ScenarioDraftState): boolean {
  return Object.keys(state.changes).length > 0 ||
    JSON.stringify(state.acceptedConflictKeys) !== JSON.stringify(state.originalAcceptedConflictKeys);
}

export function suitableReplacementCandidates(input: {
  state: ScenarioDraftState;
  replacingPlanItemId: string;
  candidates: ScenarioReplacementCandidate[];
}): ScenarioReplacementCandidate[] {
  const current = effectiveScenarioItems(input.state);
  const usedActivityIds = new Set(
    current
      .filter((item) => item.planItemId !== input.replacingPlanItemId)
      .map((item) => item.activityId)
      .filter((id): id is string => id != null),
  );

  return input.candidates.filter((candidate) => {
    if (
      candidate.schedulingKind === "UNKNOWN" ||
      candidate.activityId == null ||
      usedActivityIds.has(candidate.activityId)
    ) return false;
    if (candidate.schedulingKind === "SLOT" && (!candidate.startsAt || !candidate.endsAt)) return false;
    return true;
  }).map((candidate, index) => {
    const modeled = current.map((item) =>
      item.planItemId === input.replacingPlanItemId
        ? { ...candidate, planItemId: item.planItemId }
        : item,
    );
    return { candidate, conflictCount: conflictsForScenarioItems(modeled).length, index };
  }).sort((a, b) => a.conflictCount - b.conflictCount || a.index - b.index)
    .map(({ candidate }) => candidate);
}

/** DOM-safe anchor id for a conflict's jump-link — conflict keys contain
 * `:`/`@`, which are legal in an `id` but awkward in a URL fragment. */
export function scenarioConflictAnchorId(conflictKey: string): string {
  return `conflict-${conflictKey.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

export function scenarioDraftStorageKey(date: string, baseFingerprint: string): string {
  return `scenarioDraft:${date}:${baseFingerprint}`;
}

export function serializeScenarioDraft(state: ScenarioDraftState): string {
  return JSON.stringify({ changes: state.changes, acceptedConflictKeys: state.acceptedConflictKeys });
}

export function restoreScenarioDraft(
  original: ScenarioClientItem[],
  raw: string,
  originalAcceptedConflictKeys: string[] = [],
): ScenarioDraftState | null {
  try {
    const parsed = JSON.parse(raw) as Partial<ScenarioDraftState>;
    if (!parsed.changes || typeof parsed.changes !== "object" || !Array.isArray(parsed.acceptedConflictKeys)) return null;
    const originalIds = new Set(original.map((item) => item.planItemId));
    if (Object.keys(parsed.changes).some((id) => !originalIds.has(id))) return null;
    return pruneAccepted({
      original,
      originalAcceptedConflictKeys: [...originalAcceptedConflictKeys].sort(),
      changes: parsed.changes as Record<string, ScenarioDraftChange>,
      acceptedConflictKeys: parsed.acceptedConflictKeys.filter((key): key is string => typeof key === "string"),
    });
  } catch {
    return null;
  }
}
