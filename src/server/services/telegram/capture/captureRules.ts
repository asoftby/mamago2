import type { CaptureDraft, CaptureEntry } from "./captureDraft.schema";
import { normalizeText } from "./captureText";

/**
 * Deterministic post-LLM rules (forward-to-plan spec v1.3, section 8).
 * Pure functions: the model proposes, this code decides. The model can never
 * reference an arbitrary child, plan item or place id: every id must come
 * from the backend-provided context.
 */
export type RuleChild = { id: string; name: string | null; age: number | null };
export type RulePlanCandidate = { id: string; title: string | null; childId: string | null; startsAt: Date | null };
export type RulePlaceCandidate = { id: string; title: string; address: string; exact: boolean };

export type RuleContext = {
  children: RuleChild[];
  planCandidates: RulePlanCandidate[];
  placeShortlist: RulePlaceCandidate[];
};

export type RuleResult = {
  draft: CaptureDraft;
  matchedPlanItemId: string | null;
  ruleCodes: string[];
};

export const RULE_CODES = {
  eventToTask: "EVENT_TO_TASK",
  childAsked: "CHILD_ASKED",
  childInferred: "CHILD_INFERRED",
  childIdRejected: "CHILD_ID_REJECTED",
  matchIdRejected: "MATCH_ID_REJECTED",
  matchNoCandidate: "MATCH_NO_CANDIDATE",
  placeIdRejected: "PLACE_ID_REJECTED",
  placeAutoExact: "PLACE_AUTO_EXACT",
  escalateInvalidJson: "ESCALATE_INVALID_JSON",
  escalateBadResponse: "ESCALATE_BAD_RESPONSE",
  escalateEventDate: "ESCALATE_EVENT_DATE",
  escalateMatch: "ESCALATE_MATCH",
  duplicateFound: "DUPLICATE_FOUND",
} as const;

function cloneDraft(draft: CaptureDraft): CaptureDraft {
  return structuredClone(draft);
}

/** A date field without a value is "missing"; a "missing" field never carries a value. */
function normalizeDateFields(entry: CaptureEntry): void {
  const startsAt = entry.startsAt;
  if (startsAt.state === "missing") startsAt.value = null;
  else if (startsAt.value === null) startsAt.state = "missing";

  for (const field of [entry.arriveAt, entry.endsAt, entry.dueAt]) {
    if (field.state === "missing") field.value = null;
    else if (field.value === null) field.state = "missing";
  }
}

function addCode(codes: string[], code: string): void {
  if (!codes.includes(code)) codes.push(code);
}

export function applyPostLlmRules(input: CaptureDraft, context: RuleContext): RuleResult {
  const draft = cloneDraft(input);
  const ruleCodes: string[] = [];

  const childIds = new Set(context.children.map((child) => child.id));
  const shortlistIds = new Set(context.placeShortlist.map((place) => place.id));

  for (const entry of draft.entries) {
    normalizeDateFields(entry);

    // EVENT without a start but with a deadline is a TASK.
    if (entry.entryType === "EVENT" && entry.startsAt.value === null && entry.dueAt.value !== null) {
      entry.entryType = "TASK";
      addCode(ruleCodes, RULE_CODES.eventToTask);
    }

    // Child: only ids of the owner's children are accepted.
    if (entry.child.childId !== null && !childIds.has(entry.child.childId)) {
      entry.child.childId = null;
      entry.child.state = "missing";
      addCode(ruleCodes, RULE_CODES.childIdRejected);
    }
    if (entry.child.childId === null && entry.child.raw === null) {
      entry.child.state = "missing";
      if (context.children.length === 1) {
        entry.child.childId = context.children[0]!.id;
        entry.child.state = "inferred";
        addCode(ruleCodes, RULE_CODES.childInferred);
      } else if (context.children.length >= 2) {
        addCode(ruleCodes, RULE_CODES.childAsked);
      }
    } else if (entry.child.childId === null && context.children.length >= 2) {
      // A child was named but could not be mapped to one of the owner's children.
      addCode(ruleCodes, RULE_CODES.childAsked);
    }

    // Place: only ids from the backend shortlist are accepted.
    const { location } = entry;
    if (location.placeId !== null && !shortlistIds.has(location.placeId)) {
      location.placeId = null;
      addCode(ruleCodes, RULE_CODES.placeIdRejected);
    }
    if (location.placeId === null && location.value !== null) {
      // Per entry: only a shortlisted place whose normalized title equals THIS
      // entry's normalized location, and only when exactly one does. A place
      // matched for one event of a message must never leak to another event.
      const wanted = normalizeText(location.value);
      const exact = wanted ? context.placeShortlist.filter((place) => normalizeText(place.title) === wanted) : [];
      if (exact.length === 1) {
        location.placeId = exact[0]!.id;
        addCode(ruleCodes, RULE_CODES.placeAutoExact);
      }
    }
    if (location.placeId !== null) location.state = "inferred";
  }

  // Plan match: a hypothesis that must come from the backend candidates.
  const candidateIds = new Set(context.planCandidates.map((candidate) => candidate.id));
  let matchedPlanItemId: string | null = null;
  const proposed = draft.match.candidatePlanItemId;
  if (proposed !== null && !candidateIds.has(proposed)) {
    draft.match.candidatePlanItemId = null;
    draft.match.changes = [];
    addCode(ruleCodes, RULE_CODES.matchIdRejected);
  } else if (proposed !== null) {
    matchedPlanItemId = proposed;
  }

  if (draft.intent === "UPDATE" || draft.intent === "CANCEL") {
    if (matchedPlanItemId === null) addCode(ruleCodes, RULE_CODES.matchNoCandidate);
  } else {
    // CREATE / NONE never carry a match.
    matchedPlanItemId = null;
    draft.match.candidatePlanItemId = null;
    draft.match.changes = [];
  }

  return { draft, matchedPlanItemId, ruleCodes };
}

const MONTHS =
  "января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря|янв|фев|мар|апр|июн|июл|авг|сен|сент|окт|ноя|дек";

/** Numeric dates and "9 октября"-style dates: explicit date signals in the source. */
export function hasExplicitDateSignal(text: string): boolean {
  if (!text) return false;
  return (
    /(?<![\d.])\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?(?![\d])/u.test(text) ||
    /(?<!\d)20\d{2}-\d{2}-\d{2}(?!\d)/u.test(text) ||
    new RegExp(`(?<!\\d)\\d{1,2}\\s+(?:${MONTHS})(?![\\p{L}])`, "iu").test(text)
  );
}

/** Escalation reason (spec section 8) for the first parse result, or null. */
export type EscalationReason = "ESCALATE_EVENT_DATE" | "ESCALATE_MATCH";

export function detectEscalationReason(
  result: RuleResult,
  context: RuleContext,
  sourceText: string,
): EscalationReason | null {
  const eventWithoutDate = result.draft.entries.some(
    (entry) => entry.entryType === "EVENT" && entry.startsAt.value === null && entry.dueAt.value === null,
  );
  if (eventWithoutDate && hasExplicitDateSignal(sourceText)) return "ESCALATE_EVENT_DATE";

  if (
    (result.draft.intent === "UPDATE" || result.draft.intent === "CANCEL") &&
    result.matchedPlanItemId === null &&
    context.planCandidates.length > 0
  ) {
    return "ESCALATE_MATCH";
  }
  return null;
}
