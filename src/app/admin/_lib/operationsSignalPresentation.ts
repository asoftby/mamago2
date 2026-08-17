/**
 * Pure Operations Center presentation logic (§21 UI phase) — signal
 * sorting, NEW classification, and relative-time formatting. Kept
 * framework-free and directly unit-tested; no Prisma enum ordering is
 * relied on from the backend query.
 */
import type { NodeState } from "@/server/ops/types";

export interface SortableSignal {
  id: string;
  severity: "CRITICAL" | "WARNING";
  acknowledgedAt: Date | null;
  openedAt: Date | null;
  attentionChangedAt: Date | null;
}

/**
 * "New" = attentionChangedAt strictly after the PREVIOUS lastViewedAt —
 * never openedAt. Acknowledging a signal also clears its "new" status,
 * per the frozen UX contract, regardless of attentionChangedAt timing.
 * No localStorage, no client-invented unread state.
 */
export function isSignalNew(signal: SortableSignal, previousLastViewedAt: Date | null): boolean {
  if (signal.acknowledgedAt) return false;
  if (!signal.attentionChangedAt) return false;
  if (!previousLastViewedAt) return true;
  return signal.attentionChangedAt.getTime() > previousLastViewedAt.getTime();
}

const SEVERITY_RANK: Record<SortableSignal["severity"], number> = { CRITICAL: 0, WARNING: 1 };

function tierRank(signal: SortableSignal, isNew: boolean): number {
  if (isNew) return 0; // new unacknowledged
  if (signal.acknowledgedAt) return 2; // acknowledged
  return 1; // other unacknowledged
}

/**
 * Frozen order:
 *   1. new unacknowledged CRITICAL   4. new unacknowledged WARNING
 *   2. other unacknowledged CRITICAL 5. other unacknowledged WARNING
 *   3. acknowledged CRITICAL         6. acknowledged WARNING
 * Within every bucket: older openedAt first (stable, non-arbitrary tiebreak).
 */
export function sortSignals<T extends SortableSignal>(signals: T[], previousLastViewedAt: Date | null): T[] {
  return [...signals].sort((a, b) => {
    const bucketA = SEVERITY_RANK[a.severity] * 3 + tierRank(a, isSignalNew(a, previousLastViewedAt));
    const bucketB = SEVERITY_RANK[b.severity] * 3 + tierRank(b, isSignalNew(b, previousLastViewedAt));
    if (bucketA !== bucketB) return bucketA - bucketB;

    const openedA = a.openedAt?.getTime() ?? 0;
    const openedB = b.openedAt?.getTime() ?? 0;
    return openedA - openedB;
  });
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** "Открыт N ч назад" style relative age, from `openedAt` — never firstSeenAt/lastSeenAt/attentionChangedAt. */
export function formatOpenedAge(openedAt: Date, now: Date): string {
  const deltaMs = Math.max(0, now.getTime() - openedAt.getTime());
  if (deltaMs < MINUTE_MS) return "Открыт только что";
  if (deltaMs < HOUR_MS) return `Открыт ${Math.floor(deltaMs / MINUTE_MS)} мин назад`;
  if (deltaMs < DAY_MS) return `Открыт ${Math.floor(deltaMs / HOUR_MS)} ч назад`;
  const days = Math.floor(deltaMs / DAY_MS);
  return `Открыт ${days} ${pluralDays(days)} назад`;
}

function pluralDays(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "день";
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return "дня";
  return "дней";
}

/** "Обновлено N сек. назад" freshness label — display formatting only, never a substitute for backend `stale`. */
export function formatFreshness(generatedAt: Date, now: Date): string {
  const deltaSec = Math.max(0, Math.round((now.getTime() - generatedAt.getTime()) / 1000));
  if (deltaSec < 60) return `Обновлено ${deltaSec} сек. назад`;
  const minutes = Math.floor(deltaSec / 60);
  if (minutes < 60) return `Обновлено ${minutes} мин. назад`;
  const hours = Math.floor(minutes / 60);
  return `Обновлено ${hours} ч. назад`;
}

/**
 * Empty is success — but ONLY when the snapshot itself is fresh and proven
 * OK. A stale synthetic signal must never be masked by the empty state,
 * even if the visible persistent-signal list happens to be empty.
 */
export function isHealthyEmpty(stale: boolean, visibleSignalCount: number, hasStaleSynthetic: boolean): boolean {
  return !stale && visibleSignalCount === 0 && !hasStaleSynthetic;
}

export const NODE_STATE_LABEL: Record<NodeState, string> = {
  OK: "Работает",
  WARNING: "Внимание",
  CRITICAL: "Проблема",
  NO_DATA: "Нет данных",
};

export const NODE_STATE_STYLE: Record<NodeState, { dot: string; text: string; bg: string; border: string }> = {
  OK: { dot: "bg-green-500", text: "text-green-700", bg: "bg-green-50", border: "border-green-200" },
  WARNING: { dot: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" },
  CRITICAL: { dot: "bg-red-500", text: "text-red-700", bg: "bg-red-50", border: "border-red-200" },
  NO_DATA: { dot: "bg-gray-400", text: "text-gray-500", bg: "bg-gray-50", border: "border-gray-200" },
};
