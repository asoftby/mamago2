import { buildAdminPath } from "@/lib/routing/surface";

/** Совпадает с {@link buildAdminPath} / `adminPath` — общий префикс `/admin`. */

/** Идентификаторы пунктов секции «Модерация» в сайдбаре — только процесс (inbox). */
export type ModerationNavItemId = "queue";

export interface ModerationNavItemDefinition {
  id: ModerationNavItemId;
  label: string;
  /** Путь относительно `/admin` (с ведущим `/`) */
  path: string;
}

/**
 * Единый источник структуры подменю «Модерация».
 * Списочные сущности перенесены в «Контент».
 */
export const MODERATION_NAV_ITEMS: readonly ModerationNavItemDefinition[] = [
  { id: "queue", label: "Очередь", path: "/moderation/queue" },
] as const;

export function moderationItemHref(path: string): string {
  return buildAdminPath(path);
}

/** Счётчики для бейджа очереди; детальные поля — для отчётов/хедера при необходимости */
export interface ModerationNavCounts {
  /** Единый inbox: все сущности, ожидающие модерации */
  queueTotal: number;
  places?: number;
  events?: number;
  offers?: number;
}

export const MODERATION_NAV_COUNTS: ModerationNavCounts = {
  queueTotal: 0,
  places: 0,
  events: 0,
  offers: 0,
};

export function getModerationItemCount(
  id: ModerationNavItemId,
  counts: ModerationNavCounts,
): number | undefined {
  switch (id) {
    case "queue":
      return counts.queueTotal;
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}

/** Активный подпункт: точное совпадение или вложенный маршрут. */
export function isModerationNavItemActive(pathname: string, itemPath: string): boolean {
  const href = moderationItemHref(itemPath);
  if (pathname === href) return true;
  if (pathname.startsWith(`${href}/`)) return true;
  return false;
}
