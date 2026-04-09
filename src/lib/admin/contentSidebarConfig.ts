/** Совпадает с {@link adminPath} в `AdminNav` — общий префикс `/admin`. */
const ADMIN_BASE = "/admin";

function toAdminHref(path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${ADMIN_BASE}${cleanPath}`;
}

export type ContentNavItemId =
  | "events"
  | "places"
  | "offers"
  | "publications"
  | "media";

export interface ContentNavItemDefinition {
  id: ContentNavItemId;
  label: string;
  /** Путь относительно `/admin` (с ведущим `/`) */
  path: string;
}

/**
 * Единый источник подменю «Контент» — сущности и материалы (не процесс модерации).
 */
export const CONTENT_NAV_ITEMS: readonly ContentNavItemDefinition[] = [
  { id: "events", label: "События", path: "/content/events" },
  { id: "places", label: "Места", path: "/content/places" },
  { id: "offers", label: "Предложения", path: "/content/offers" },
  { id: "publications", label: "Публикации", path: "/content/publications" },
  { id: "media", label: "Медиатека", path: "/media" },
] as const;

export function contentItemHref(path: string): string {
  return toAdminHref(path);
}

/** Активный подпункт: точное совпадение или вложенный маршрут. */
export function isContentNavItemActive(pathname: string, itemPath: string): boolean {
  const href = contentItemHref(itemPath);
  if (pathname === href) return true;
  if (pathname.startsWith(`${href}/`)) return true;
  return false;
}
