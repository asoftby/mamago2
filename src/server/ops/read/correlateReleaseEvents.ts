/**
 * Per-signal ReleaseEvent correlation (§21 UI phase — smallest read-side
 * extension needed; no schema change, no detector change, no snapshot
 * redesign, no release semantics change).
 *
 * The frozen contract wants incidents to surface a relevant ReleaseEvent
 * within openedAt ±30 minutes when available. The existing snapshot
 * payload only ever exposes the single latest ReleaseEvent — no query
 * anywhere correlates ReleaseEvent against individual signals — so this
 * adds exactly one indexed, bounded `detectedAt` range query covering
 * every visible signal at once (never N+1), then matches in memory.
 */
import type { PrismaClient } from "@prisma/client";

export const RELEASE_CORRELATION_WINDOW_MS = 30 * 60 * 1000;

export interface CorrelatedRelease {
  buildId: string;
  gitSha: string | null;
  detectedAt: Date;
}

interface ReleaseEventCandidate {
  buildId: string;
  gitSha: string | null;
  detectedAt: Date;
}

/** Pure: the candidate closest to `openedAt`, only if within the window. */
export function findNearestRelease(
  candidates: ReleaseEventCandidate[],
  openedAt: Date,
): CorrelatedRelease | null {
  let best: ReleaseEventCandidate | null = null;
  let bestDelta = Infinity;
  for (const candidate of candidates) {
    const delta = Math.abs(candidate.detectedAt.getTime() - openedAt.getTime());
    if (delta <= RELEASE_CORRELATION_WINDOW_MS && delta < bestDelta) {
      best = candidate;
      bestDelta = delta;
    }
  }
  return best;
}

export interface CorrelatableSignal {
  id: string;
  openedAt: Date | null;
}

/**
 * One bounded query spanning every visible signal's ±30min window, then an
 * in-memory nearest-match per signal — never N+1 queries.
 */
export async function correlateSignalReleases(
  prisma: PrismaClient,
  signals: CorrelatableSignal[],
): Promise<Record<string, CorrelatedRelease | null>> {
  const openedTimes = signals
    .map((s) => s.openedAt)
    .filter((d): d is Date => d !== null);

  if (openedTimes.length === 0) return {};

  const minTime = new Date(Math.min(...openedTimes.map((d) => d.getTime())) - RELEASE_CORRELATION_WINDOW_MS);
  const maxTime = new Date(Math.max(...openedTimes.map((d) => d.getTime())) + RELEASE_CORRELATION_WINDOW_MS);

  const candidates = await prisma.releaseEvent.findMany({
    where: { detectedAt: { gte: minTime, lte: maxTime } },
    orderBy: { detectedAt: "asc" },
    select: { buildId: true, gitSha: true, detectedAt: true },
  });

  const result: Record<string, CorrelatedRelease | null> = {};
  for (const signal of signals) {
    result[signal.id] = signal.openedAt ? findNearestRelease(candidates, signal.openedAt) : null;
  }
  return result;
}
