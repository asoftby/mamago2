import { DISCOVERY_INTENT_CONFIG, DISCOVERY_INTENT_ITEMS } from "@/lib/discovery/discoveryIntentConfig";

export type Intent = "kuda" | "classes" | "birthday" | "routes";

export interface IntentItem {
  id: Intent;
  label: string;
  href: (city: string) => string;
}

// Export the intent items from the centralized config
export const INTENT_ITEMS: IntentItem[] = DISCOVERY_INTENT_ITEMS.map(config => ({
  id: config.id,
  label: config.label,
  href: config.href,
}));

/** Список городов с городским хабом `/{city}` */
export const VALID_CITY_SLUGS = ["minsk"] as const;

/** Главная страница текущего города-флагмана (первый slug в `VALID_CITY_SLUGS`) */
export const DEFAULT_CITY_HUB_PATH = `/${VALID_CITY_SLUGS[0]}`;

export type CitySlug = (typeof VALID_CITY_SLUGS)[number];

export function isCityHubPath(pathname: string | null): boolean {
  if (!pathname) return false;
  const segments = pathname.split("/").filter(Boolean);
  return segments.length === 1 && VALID_CITY_SLUGS.includes(segments[0] as CitySlug);
}

/** Карточка публикации (активность/событие): `/{city}/activity/{id}` */
export function isPublicationDetailPath(pathname: string | null): boolean {
  if (!pathname) return false;
  const segments = pathname.split("/").filter(Boolean);
  return segments.length >= 3 && segments[1] === "activity";
}

/**
 * Страницы контента публикаций — без фиксированного mobile bottom bar
 * (статья, место, маршрут, событие, короткая ссылка).
 */
export function shouldHideMobileBottomNav(pathname: string | null): boolean {
  if (!pathname) return false;
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length < 2) return false;

  if (segments[0] === "blog") return true;
  if (segments[0] === "places") return true;
  if (segments[0] === "p") return true;
  if (segments[0] === "routes" && segments[1] !== "new") return true;

  return isPublicationDetailPath(pathname);
}

/**
 * Какой раздел discovery связан со страницей публикации (для подстановки сохранённых фильтров).
 */
export function getDiscoveryIntentForPublicationPath(
  pathname: string | null,
): Intent | null {
  if (!pathname) return null;
  const s = pathname.split("/").filter(Boolean);
  if (s.length < 2) return null;
  if (s[0] === "blog") return "kuda";
  if (s[0] === "places") return "kuda";
  if (s[0] === "p") return "kuda";
  if (s[0] === "routes" && s[1] !== "new") return "routes";
  if (s.length >= 3 && s[1] === "activity") return "kuda";
  return null;
}

export function getIntentFromPath(pathname: string | null): Intent | null {
  if (!pathname) return null;

  const segments = pathname.split("/").filter(Boolean);
  if (segments.length < 1) return null;

  /** Односегментные пути: хаб города, блог, landing — не вкладка discovery */
  if (segments.length === 1) {
    return null;
  }

  /** Детальные страницы /city/activity/id и т.д. */
  if (segments.length > 2) return null;

  const potentialIntent = segments[1];

  if (potentialIntent === "kuda") return "kuda";
  if (potentialIntent === "classes") return "classes";
  if (potentialIntent === "birthday") return "birthday";
  if (potentialIntent === "routes") return "routes";

  return null;
}

// List of known non-city route prefixes
const NON_CITY_ROUTES = [
  "me",
  "login",
  "register",
  "forgot-password",
  "reset-password",
  "places",
  "ui-test",
  "account",
  "admin",
  "business",
  "api",
  "_next",
];

export function getCityFromPath(pathname: string | null): string | null {
  if (!pathname) return null;
  
  const segments = pathname.split('/').filter(Boolean);
  const firstSegment = segments[0];
  
  if (!firstSegment) return null;
  
  // Check if first segment is a known non-city route
  if (NON_CITY_ROUTES.includes(firstSegment)) {
    return null;
  }
  
  if ((VALID_CITY_SLUGS as readonly string[]).includes(firstSegment)) {
    return firstSegment;
  }
  
  // Unknown segment - could be a new city or invalid route
  // Return null to be safe
  return null;
}
