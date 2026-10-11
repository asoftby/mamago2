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
