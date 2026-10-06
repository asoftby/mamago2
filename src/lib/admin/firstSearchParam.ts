/**
 * Normalize Next.js searchParams values that may be `string | string[]`.
 * Repeated keys (`?q=a&q=b`) must not crash parsers that call `.trim()`.
 */
export function firstSearchParam(
  value: string | string[] | undefined,
): string | undefined {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first === "string" ? first : undefined;
  }
  return value;
}
