import type { ArticleAuthorshipEntry, Slice17Decision } from "./types";

const CONFLICT_CLASSIFICATIONS = new Set(["BLOCKED", "ARTICLE_LINEAGE_CONFLICT", "TARGET_ARTICLE_MISSING", "EXISTING_AUTHOR_CONFLICT"]);
const CLOSED_CLASSIFICATIONS = new Set(["ALREADY_SATISFIED", "SOURCE_SCOPE_EXCLUDED"]);

/**
 * Any conflict anywhere always wins (needs a founder decision before any
 * further action); otherwise an EXACT_AUTHORSHIP_CANDIDATE is more
 * "ready to act on" than a not-yet-migrated target, so it takes priority
 * over ARTICLE_GOLDEN_REQUIRED; only once every entry is already closed
 * (satisfied or out of scope) is the workstream fully done.
 */
export function determineSlice17Decision(entries: readonly ArticleAuthorshipEntry[]): Slice17Decision {
  if (entries.some(entry => CONFLICT_CLASSIFICATIONS.has(entry.classification))) return "BLOCKED";
  if (entries.some(entry => entry.classification === "EXACT_AUTHORSHIP_CANDIDATE")) return "AUTHORSHIP_GOLDEN_READY";
  if (entries.some(entry => entry.classification === "ARTICLE_TARGET_NOT_MIGRATED")) return "ARTICLE_GOLDEN_REQUIRED";
  if (entries.every(entry => CLOSED_CLASSIFICATIONS.has(entry.classification))) return "AUTHORSHIP_ALREADY_SATISFIED";
  return "BLOCKED";
}
