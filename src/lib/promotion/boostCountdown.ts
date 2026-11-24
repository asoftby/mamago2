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


/** Server-provided deadline is the only source of truth; the browser only renders it. */
export function getBoostRemainingMs(
  endsAt: Date | string | null | undefined,
  nowMs: number,
): number | null {
  if (!endsAt) return null;
  const endMs = new Date(endsAt).getTime();
  if (!Number.isFinite(endMs)) return null;
  return Math.max(0, endMs - nowMs);
}

/** Canonical live UI format: at least two digits for hours, always HH:MM:SS. */
export function formatBoostCountdownHms(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function formatBoostCountdownAria(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  return `До завершения продвижения: ${Math.floor(totalSeconds / 3600)} ч ${Math.floor((totalSeconds % 3600) / 60)} мин ${totalSeconds % 60} сек`;
}

/** Read the active period returned by the server; never invent an end time. */
export function getActiveBoostEndAt(
  performance: {
    periods: ReadonlyArray<{ isActive: boolean; endAt: Date | string }>;
  } | null | undefined,
): Date | string | null {
  return performance?.periods.find((period) => period.isActive)?.endAt ?? null;
}
