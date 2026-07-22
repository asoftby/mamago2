/** Normalize display text that is contractually a single line. Never use for rich/multiline content. */
export function normalizeSingleLineText(value: string): string {
  return value.replace(/\p{Zs}/gu, " ").replace(/\s+/gu, " ").trim();
}
