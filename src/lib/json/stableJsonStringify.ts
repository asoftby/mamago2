/**
 * Deterministic JSON string for comparing persisted Json values vs client payloads
 * (key order and insertion order in objects must not cause false negatives).
 */
export function stableJsonStringify(value: unknown): string {
  return JSON.stringify(sortDeep(value));
}

function sortDeep(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(sortDeep);
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    out[k] = sortDeep(obj[k]);
  }
  return out;
}
