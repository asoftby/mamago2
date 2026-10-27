/**
 * A4 (ТЗ «Аналитика админки»): когда в этой среде (DEV/PROD) DETAIL_OPEN
 * начал писаться с клиента с фильтром ботов.
 *
 * Дата не задаётся вручную: это `createdAt` первой строки UserEvent с
 * непустым `clientClass` (колонку заполняет только новый ingestion-путь).
 * Старые DETAIL_OPEN не удаляются; отчёты Analytics, чьё окно начинается
 * раньше этой даты, показывают плашку «до исправления трекинга».
 *
 * Найденная дата неизменна → кэшируется навсегда; пока её нет, повторный
 * запрос не чаще раза в RECHECK_MS.
 */
import type { PrismaClient } from "@prisma/client";

const RECHECK_MS = 10 * 60 * 1000;

let cachedFixedAt: Date | null = null;
let lastCheckedAt = 0;

export function __resetDetailOpenTrackingFixCacheForTests(): void {
  cachedFixedAt = null;
  lastCheckedAt = 0;
}

export async function getDetailOpenTrackingFixedAt(prisma: PrismaClient, now = Date.now()): Promise<Date | null> {
  if (cachedFixedAt) return cachedFixedAt;
  if (now - lastCheckedAt < RECHECK_MS && lastCheckedAt !== 0) return null;
  lastCheckedAt = now;
  // (eventType, createdAt) index: ordered scan of DETAIL_OPEN rows, stops at the first classified one.
  const row = await prisma.userEvent.findFirst({
    where: { eventType: "DETAIL_OPEN", clientClass: { not: null } },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });
  cachedFixedAt = row?.createdAt ?? null;
  return cachedFixedAt;
}

export interface DetailOpenTrackingStatus {
  /** ISO instant tracking was fixed in this environment, or null if not yet observed. */
  fixedAt: string | null;
  /** True when the reporting window starts before the fix (or the fix isn't observed yet). */
  rangeIncludesPreFixData: boolean;
}

export function detailOpenTrackingStatusForRange(fixedAt: Date | null, rangeStart: Date): DetailOpenTrackingStatus {
  return {
    fixedAt: fixedAt ? fixedAt.toISOString() : null,
    rangeIncludesPreFixData: fixedAt === null || rangeStart < fixedAt,
  };
}
