import type { CaptureDraft } from "./captureDraft.schema";
import {
  CAPTURE_TARGET_ALL_RULE,
  CAPTURE_TARGET_ME_RULE,
  CAPTURE_TARGET_CHILD_RULE,
} from "./captureReplies";

/** Deterministic owner correction, without a paid model call or name guessing. */
export function parseOwnerOnlyCorrection(text: string): "me" | "all" | null {
  const normalized = text.trim().replace(/[.!?]+$/u, "").trim();
  const match = /^(?:не\s+.+?[,;]?\s+а\s+)?(?:это\s+)?(для\s+меня|мне|я(?:\s+[\p{L}-]+)?|для\s+всех|вся\s+семья|для\s+всей\s+семьи)$/iu.exec(normalized);
  if (!match) return null;
  return /^(для\s+всех|вся\s+семья|для\s+всей\s+семьи)$/iu.test(match[1]!) ? "all" : "me";
}

export function applyOwnerCorrection(
  draft: CaptureDraft,
  target: "me" | "all",
): { draft: CaptureDraft; ruleCode: string } {
  const next = structuredClone(draft);
  for (const entry of next.entries) {
    entry.child = { childId: null, raw: null, state: "missing" };
  }
  return { draft: next, ruleCode: target === "me" ? CAPTURE_TARGET_ME_RULE : CAPTURE_TARGET_ALL_RULE };
}

export function retainTargetRules(codes: string[]): string[] {
  return codes.filter((code) => [CAPTURE_TARGET_ME_RULE, CAPTURE_TARGET_ALL_RULE, CAPTURE_TARGET_CHILD_RULE].includes(code));
}


/**
 * Keep explicit family assignment and the parsed draft in sync.
 * Only a recipient-directed edit may switch from "Я"/"Для всех" to a child.
 * A model's unrelated child guess must not silently override a selected target.
 */
export function reconcileEditedTarget(input: {
  previous: CaptureDraft;
  updated: CaptureDraft;
  previousRules: readonly string[];
  instruction: string;
}): { draft: CaptureDraft; targetRules: string[] } {
  const { previous, updated, previousRules, instruction } = input;
  const existing = retainTargetRules([...previousRules]);
  const selected = existing[0] ?? null;

  // The model must resolve the name against the trusted family child IDs.
  // Require a recipient-change instruction before trusting an edited childId.
  const changesRecipient = /(?:(?:^|\s)для\s+|(?:^|\s)кому\s+|(?:^|\s)вместо\s+|(?:^|\s)не\s+.+?\s+а\s+)/iu.test(instruction);
  const nextIds = updated.entries.map((item) => item.child.childId);
  const oneChild = nextIds.length > 0
    && nextIds[0] != null
    && nextIds.every((id) => id === nextIds[0]);
  if (changesRecipient && oneChild) {
    return { draft: updated, targetRules: [CAPTURE_TARGET_CHILD_RULE] };
  }

  if (selected === CAPTURE_TARGET_ME_RULE || selected === CAPTURE_TARGET_ALL_RULE) {
    // The chosen adult/family scope wins over incidental child IDs from an LLM.
    const target = selected === CAPTURE_TARGET_ME_RULE ? "me" : "all";
    return { draft: applyOwnerCorrection(updated, target).draft, targetRules: [selected] };
  }

  if (selected === CAPTURE_TARGET_CHILD_RULE) {
    // Preserve a previously selected child when a time/location edit accidentally drops it.
    const preserved = structuredClone(updated);
    if (preserved.entries.length === previous.entries.length) {
      for (const [index, item] of preserved.entries.entries()) {
        if (!item.child.childId && previous.entries[index]?.child.childId) {
          item.child = structuredClone(previous.entries[index]!.child);
        }
      }
    }
    return { draft: preserved, targetRules: [selected] };
  }

  // No target chosen yet: the card still requires an explicit choice.
  return { draft: updated, targetRules: [] };
}
