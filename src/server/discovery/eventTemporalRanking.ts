/** Default planning horizon, with an explicit extension for editorially tagged seasonal events. */
export const KUDA_DEFAULT_HORIZON_DAYS = 45;
export const KUDA_SEASONAL_HORIZON_DAYS = 90;
const DAY_MS = 86_400_000;

/**
 * Organic temporal ranking independent of engagement and paid boosts.
 * 0–14 days retain the strongest proximity advantage; opportunities later in
 * the 45–90 day planning horizon remain discoverable rather than receiving zero.
 */
export function eventTemporalScore(input: {
  now: Date;
  nextOccurrenceAt: Date | null;
  sessions: ReadonlyArray<{ startsAt: Date }>;
  seasonal?: boolean;
}): number {
  const nowMs = input.now.getTime();
  const future = input.sessions
    .map((session) => session.startsAt.getTime())
    .filter((time) => Number.isFinite(time) && time >= nowMs)
    .sort((a, b) => a - b);
  const cached = input.nextOccurrenceAt?.getTime();
  const next = future[0] ?? (cached != null && cached >= nowMs ? cached : null);
  if (next === null) return 5; // Always/on-demand without a concrete occurrence.

  const daysUntil = (next - nowMs) / DAY_MS;
  const proximity = daysUntil <= 14
    ? 60 - 2 * daysUntil
    : daysUntil <= 45
      ? 32 - (20 * (daysUntil - 14)) / 31
      : Math.max(2, 12 - (10 * (daysUntil - 45)) / 45);

  // Number of *distinct available days*, not raw sessions (multiple shows in
  // a day are still one opportunity to visit on that day).
  const horizonEnd = nowMs + KUDA_DEFAULT_HORIZON_DAYS * DAY_MS;
  const distinctDays = new Set(
    future.filter((time) => time < horizonEnd)
      .map((time) => Math.floor((time - nowMs) / DAY_MS)),
  ).size;
  const scarcity = distinctDays <= 1 ? 25 : distinctDays <= 3 ? 18 : distinctDays <= 7 ? 10 : 0;
  const endingSoon = future.length > 0 &&
    future[future.length - 1]! < nowMs + 3 * DAY_MS ? 15 : 0;

  // A modest editorial relevance signal; a December holiday should be
  // discoverable in October, not outrank tomorrow's one-off by default.
  const seasonalBoost = input.seasonal && daysUntil > 14 ? 8 : 0;
  return Math.min(100, proximity + scarcity + endingSoon + seasonalBoost);
}
