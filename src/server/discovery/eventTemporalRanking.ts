/**
 * Organic temporal score for public Kuda events.
 * Uses the next real session where possible and does not confuse publication age
 * with an event's urgency. Values are comparable within a single request.
 */
export function eventTemporalScore(input: {
  now: Date;
  nextOccurrenceAt: Date | null;
  sessions: ReadonlyArray<{ startsAt: Date }>;
}): number {
  const nowMs = input.now.getTime();
  const future = input.sessions
    .map((session) => session.startsAt.getTime())
    .filter((time) => Number.isFinite(time) && time >= nowMs)
    .sort((a, b) => a - b);
  const cached = input.nextOccurrenceAt?.getTime();
  const next = future[0] ?? (cached != null && cached >= nowMs ? cached : null);
  if (next === null) return 5; // Always/on-demand activities without a concrete session.

  const daysUntil = (next - nowMs) / 86_400_000;
  const proximity = Math.max(0, 60 * (1 - daysUntil / 14));
  const inHorizon = future.filter((time) => time < nowMs + 14 * 86_400_000);
  const distinctDays = new Set(inHorizon.map((time) => Math.floor((time - nowMs) / 86_400_000))).size;
  const scarcity = distinctDays <= 1 ? 25 : distinctDays <= 3 ? 18 : distinctDays <= 7 ? 10 : 0;
  const endingSoon = future.length > 0 &&
    future[future.length - 1]! < nowMs + 3 * 86_400_000 ? 15 : 0;
  return Math.min(100, proximity + scarcity + endingSoon);
}
