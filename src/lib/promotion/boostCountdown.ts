/**
 * Browser-only display helper. Server enforces the 24h quota; this countdown
 * does not grant permission to activate a Boost.
 */
export function getBoostRemainingMinutes(nextAt: string, nowMs: number): number {
  const deadline = Date.parse(nextAt);
  if (!Number.isFinite(deadline)) return 0;
  return Math.max(0, Math.ceil((deadline - nowMs) / 60_000));
}

export function formatBoostCountdown(remainingMinutes: number): string {
  const safe = Math.max(0, Math.floor(remainingMinutes));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}
