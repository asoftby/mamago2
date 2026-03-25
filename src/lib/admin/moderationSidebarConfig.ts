/** Совпадает с {@link adminPath} в `AdminNav` — общий префикс `/admin`. */
const ADMIN_BASE = "/admin";

function toAdminHref(path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${ADMIN_BASE}${cleanPath}`;
}

/** Идентификаторы пунктов секции «Модерация» в сайдбаре */
export type ModerationNavItemId =
  | "queue"
  | "places"
  | "events"
  | "offers";

export interface ModerationNavItemDefinition {
  id: ModerationNavItemId;
  label: string;
  /** Путь относительно `/admin` (с ведущим `/`) */
  path: string;
}

/**
 * Единый источник структуры подменю «Модерация».
 * Счётчики подставляются отдельно через {@link ModerationNavCounts}.
 */
export const MODERATION_NAV_ITEMS: readonly ModerationNavItemDefinition[] = [
  { id: "queue", label: "Очередь", path: "/moderation/queue" },
  { id: "places", label: "Места", path: "/moderation/places" },
  { id: "events", label: "События", path: "/moderation/events" },
  { id: "offers", label: "Предложения", path: "/moderation/offers" },
] as const;

export function moderationItemHref(path: string): string {
  return toAdminHref(path);
}

/** Счётчики pending для бейджей; поля опциональны — без значения бейдж не показываем */
export interface ModerationNavCounts {
  /** Общее число элементов в очереди (как на странице очереди) */
  queueTotal: number;
  /** Места со статусом PENDING */
  places?: number;
  /** Активности (события и др.) со статусом PENDING */
  events?: number;
  /** Предложения (Offer) со статусом PENDING */
  offers?: number;
}

export function getModerationItemCount(
  id: ModerationNavItemId,
  counts: ModerationNavCounts,
): number | undefined {
  switch (id) {
    case "queue":
      return counts.queueTotal;
    case "places":
      return counts.places;
    case "events":
      return counts.events;
    case "offers":
      return counts.offers;
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}

/** Активный подпункт: точное совпадение или вложенный маршрут (например `/places/[id]`). */
export function isModerationNavItemActive(pathname: string, itemPath: string): boolean {
  const href = moderationItemHref(itemPath);
  if (pathname === href) return true;
  if (pathname.startsWith(`${href}/`)) return true;
  return false;
}
