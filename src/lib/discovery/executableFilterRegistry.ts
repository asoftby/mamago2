import type { Intent } from "@/lib/intent";

/**
 * Code owns meaning; Admin/DB records may only decide presentation.
 * Adding an Admin definition never makes a new query executable.
 */
export const EVENT_EXECUTABLE_FILTER_KEYS = [
  "date",
  "free",
  "age",
  "format",
  "district",
  "metro",
  "adultOnly",
] as const;

export type EventExecutableFilterKey = (typeof EVENT_EXECUTABLE_FILTER_KEYS)[number];

const EVENT_KEY_SET = new Set<string>(EVENT_EXECUTABLE_FILTER_KEYS);

export function isExecutableEventFilterKey(key: string): key is EventExecutableFilterKey {
  return EVENT_KEY_SET.has(key);
}

const EXECUTABLE_ADMIN_KEYS: Readonly<Partial<Record<Intent, ReadonlySet<string>>>> = {
  // This legacy DB definition maps to the code-owned `free` query semantics.
  kuda: new Set(["free_only", "adult_only"]),
};

export function isExecutableAdminFilterKey(intent: Intent, key: string): boolean {
  return EXECUTABLE_ADMIN_KEYS[intent]?.has(key) ?? false;
}
