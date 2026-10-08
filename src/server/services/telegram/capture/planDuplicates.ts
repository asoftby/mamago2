import type { PlanItemSource, PrismaClient } from "@prisma/client";
import { getTimeZoneDateKey } from "@/lib/notifications/userNotificationSchedule";
import type { PlanOwner } from "@/server/services/planOwner";
import type { CaptureEntry } from "./captureDraft.schema";
import { tokenize } from "./captureText";

/**
 * Deterministic duplicate detection against the owner's existing, non-cancelled
 * plan items of ANY source (catalogue items included). No LLM, no embeddings.
 * Applies to CREATE only (the caller does not run it for UPDATE/CANCEL).
 */
export const DUPLICATE_TIME_WINDOW_MS = 60 * 60 * 1000;
/** Calibrated on the fixtures in planDuplicates.test.ts. */
export const TITLE_SIMILARITY_THRESHOLD = 0.6;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_CANDIDATES = 200;

export type DuplicateCandidate = {
  id: string;
  source: PlanItemSource;
  title: string | null;
  childId: string | null;
  startsAt: Date | null;
  dueAt: Date | null;
  /** Local `YYYY-MM-DD`; nullable-safe (the column may become nullable). */
  date: string | null;
};

export type DuplicateMatch = { planItemId: string; source: PlanItemSource; score: number };

/** Cheap Russian-friendly stem: case endings must not break "музей"/"музее", "экскурсия"/"экскурсии". */
function stem(token: string): string {
  if (/^\d+$/.test(token)) return token;
  if (token.length > 5) return token.slice(0, 5);
  if (token.length === 5) return token.slice(0, 4);
  return token;
}

function titleTokenSet(title: string): Set<string> {
  return new Set(tokenize(title, { dropStopWords: true }).map(stem));
}

/** Order-independent Dice coefficient over stemmed, stop-word-free token sets (0..1). */
export function titleSimilarity(a: string, b: string): number {
  const left = titleTokenSet(a);
  const right = titleTokenSet(b);
  if (left.size === 0 || right.size === 0) return 0;
  let common = 0;
  for (const token of left) if (right.has(token)) common += 1;
  return (2 * common) / (left.size + right.size);
}

function childCompatible(entryChildId: string | null, candidateChildId: string | null): boolean {
  return entryChildId === null || candidateChildId === null || entryChildId === candidateChildId;
}

function localDay(value: Date, timeZone: string): string {
  return getTimeZoneDateKey(value, timeZone);
}

/** The instant (or null) the entry is anchored to for dedupe purposes. */
function entryInstants(entry: CaptureEntry): { startsAt: Date | null; dueAt: Date | null } {
  return {
    startsAt: entry.startsAt.value ? new Date(entry.startsAt.value) : null,
    dueAt: entry.dueAt.value ? new Date(entry.dueAt.value) : null,
  };
}

function timeCompatible(entry: CaptureEntry, candidate: DuplicateCandidate, timeZone: string): boolean {
  const { startsAt, dueAt } = entryInstants(entry);

  if (entry.entryType === "TASK") {
    const anchor = dueAt ?? startsAt;
    if (!anchor) return false;
    const key = localDay(anchor, timeZone);
    if (candidate.dueAt) return localDay(candidate.dueAt, timeZone) === key;
    if (candidate.startsAt) return localDay(candidate.startsAt, timeZone) === key;
    return candidate.date === key;
  }

  if (!startsAt) return false;
  if (candidate.startsAt) {
    return Math.abs(candidate.startsAt.getTime() - startsAt.getTime()) <= DUPLICATE_TIME_WINDOW_MS;
  }
  // Candidate without a time: same local date.
  return candidate.date !== null && candidate.date === localDay(startsAt, timeZone);
}

/** Pure scoring step; candidates are already the owner's non-cancelled items. */
export function scoreDuplicateCandidates(
  entry: CaptureEntry,
  candidates: DuplicateCandidate[],
  timeZone: string,
  threshold = TITLE_SIMILARITY_THRESHOLD,
): DuplicateMatch[] {
  if (!entry.title.value.trim()) return [];
  const matches: DuplicateMatch[] = [];
  for (const candidate of candidates) {
    if (!candidate.title) continue;
    if (!childCompatible(entry.child.childId, candidate.childId)) continue;
    if (!timeCompatible(entry, candidate, timeZone)) continue;
    const score = titleSimilarity(entry.title.value, candidate.title);
    if (score >= threshold) matches.push({ planItemId: candidate.id, source: candidate.source, score });
  }
  return matches.sort((a, b) => b.score - a.score);
}

export async function findPlanDuplicates(
  deps: { db: Pick<PrismaClient, "planItem"> },
  owner: PlanOwner,
  entry: CaptureEntry,
  timeZone: string,
): Promise<DuplicateMatch[]> {
  const { startsAt, dueAt } = entryInstants(entry);
  const anchor = entry.entryType === "TASK" ? (dueAt ?? startsAt) : startsAt;
  if (!anchor) return [];

  const key = localDay(anchor, timeZone);
  // Generous UTC window for the index; the exact local-day / ±60 min check is in memory.
  const dayWindow = { gte: new Date(anchor.getTime() - 2 * DAY_MS), lte: new Date(anchor.getTime() + 2 * DAY_MS) };
  const timeFilter =
    entry.entryType === "TASK"
      ? [{ date: key }, { dueAt: dayWindow }, { startsAt: dayWindow }]
      : [
          {
            startsAt: {
              gte: new Date(anchor.getTime() - DUPLICATE_TIME_WINDOW_MS),
              lte: new Date(anchor.getTime() + DUPLICATE_TIME_WINDOW_MS),
            },
          },
          { startsAt: null, date: key },
        ];

  const rows = await deps.db.planItem.findMany({
    where: { userId: owner.userId, cancelledAt: null, OR: timeFilter },
    select: {
      id: true,
      source: true,
      title: true,
      childId: true,
      startsAt: true,
      dueAt: true,
      date: true,
      activity: { select: { title: true } },
    },
    take: MAX_CANDIDATES,
  });

  const candidates: DuplicateCandidate[] = rows.map((row) => ({
    id: row.id,
    source: row.source,
    title: row.title ?? row.activity?.title ?? null,
    childId: row.childId,
    startsAt: row.startsAt,
    dueAt: row.dueAt,
    date: row.date ?? null,
  }));
  return scoreDuplicateCandidates(entry, candidates, timeZone);
}
