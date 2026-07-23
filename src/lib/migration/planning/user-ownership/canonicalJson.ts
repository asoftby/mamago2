import { createHash } from "node:crypto";

/**
 * Deterministic canonicalisation: object keys sorted, arrays left in the
 * order the caller provides (planners are responsible for sorting entry
 * arrays by a stable business key before calling this) so the same logical
 * input always serialises to the same bytes regardless of property
 * insertion order, map iteration order, or which run produced it.
 */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    const sortedKeys = Object.keys(value as Record<string, unknown>).sort();
    const result: Record<string, unknown> = {};
    for (const key of sortedKeys) result[key] = canonicalize((value as Record<string, unknown>)[key]);
    return result;
  }
  return value;
}

export function canonicalJsonString(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/** Hash of the canonical (order- and whitespace-independent) form of `value`. */
export function canonicalHash(value: unknown): string {
  return sha256Hex(canonicalJsonString(value));
}

/** Stable comparator for arrays of records that carry a `sourceRecordKey`. */
export function bySourceRecordKey<T extends { sourceRecordKey: string }>(a: T, b: T): number {
  return a.sourceRecordKey < b.sourceRecordKey ? -1 : a.sourceRecordKey > b.sourceRecordKey ? 1 : 0;
}

export function prettyCanonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value), null, 2) + "\n";
}
