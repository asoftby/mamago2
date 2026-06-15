/** Keeps sessions whose start time is still in the future (inclusive boundary). */
export function filterUpcomingSessions<T extends { startsAt: Date | string }>(
  sessions: readonly T[],
  now: Date,
): T[] {
  const nowMs = now.getTime();
  return sessions.filter((session) => new Date(session.startsAt).getTime() >= nowMs);
}
