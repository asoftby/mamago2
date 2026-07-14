import { buildAdminPath } from "@/lib/routing/surface";

/** Совпадает с {@link buildAdminPath} / `adminPath` — общий префикс `/admin`. */

export type ContentNavItemId =
  | "events"
  | "places"
  | "offers"
  | "routes"
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
  { id: "routes", label: "Маршруты", path: "/content/routes" },
  { id: "publications", label: "Публикации", path: "/content/publications" },
  { id: "media", label: "Медиатека", path: "/media" },
] as const;

export function contentItemHref(path: string): string {
  return buildAdminPath(path);
}

/** Активный подпункт: точное совпадение или вложенный маршрут. */
export function isContentNavItemActive(pathname: string, itemPath: string): boolean {
  const href = contentItemHref(itemPath);
  if (pathname === href) return true;
  if (pathname.startsWith(`${href}/`)) return true;
  return false;
}
