/**
 * Point vs serial classification threshold for story-rail inventory.
 *
 * Derived from Minsk public EVENT probe (N=8, 2026-07-31): bimodal gap
 * between span_days=0 (single session) and span_days=24–27 (programs).
 * MUST be revisited after the afisha grows — do not treat as universal truth.
 */
export type SerialClassificationConfig = {
  /** max(startsAt) − min(startsAt) in days (inclusive span of sessions). */
  minSpanDays: number;
  /** Minimum session rows on the parent Activity. */
  minSessionCount: number;
};

export const SERIAL_CLASSIFICATION_CONFIG: SerialClassificationConfig = {
  minSpanDays: 7,
  minSessionCount: 3,
};

export function isSerialBySessionSpan(input: {
  spanDays: number;
  sessionCount: number;
  config?: SerialClassificationConfig;
}): boolean {
  const cfg = input.config ?? SERIAL_CLASSIFICATION_CONFIG;
  return input.spanDays >= cfg.minSpanDays && input.sessionCount >= cfg.minSessionCount;
}
