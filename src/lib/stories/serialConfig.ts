/**
 * Point vs serial classification threshold for story-rail inventory.
 *
 * Derived from Minsk public EVENT probe (N=8, 2026-07-31): bimodal gap
 * between span_days=0 (single session) and span_days=24–27 (programs).
 * MUST be revisited after the afisha grows — do not treat as universal truth.
 */
export type SerialClassificationConfig = {
  /** max(startsAt) − min(startsAt) in days (wall-clock / 86400000). */
  minSpanDays: number;
  /** Minimum session rows on the parent Activity. */
  minSessionCount: number;
  /**
   * `running` slot: serial parent counts if it has ≥1 session in
   * [today 00:00, today+N 00:00) city TZ.
   */
  runningHorizonDays: number;
};

export const SERIAL_CLASSIFICATION_CONFIG: SerialClassificationConfig = {
  minSpanDays: 7,
  minSessionCount: 3,
  runningHorizonDays: 14,
};

export function isSerialBySessionSpan(input: {
  spanDays: number;
  sessionCount: number;
  config?: SerialClassificationConfig;
}): boolean {
  const cfg = input.config ?? SERIAL_CLASSIFICATION_CONFIG;
  return input.spanDays >= cfg.minSpanDays && input.sessionCount >= cfg.minSessionCount;
}

/** Same formula as `scripts/stories-serial-span-probe.ts`. */
export function sessionSpanDays(minAt: Date, maxAt: Date): number {
  return (maxAt.getTime() - minAt.getTime()) / 86_400_000;
}
