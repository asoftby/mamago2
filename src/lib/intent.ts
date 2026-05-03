import {
  DEFAULT_CITY_SLUG,
  isReservedTopLevelSegment,
  resolveRouteCitySlug,
} from "@/lib/city/resolveCityContext";
import { KNOWN_CITY_SLUGS } from "@/lib/city/cityDisplayNames";
import { DISCOVERY_INTENT_ITEMS } from "@/lib/discovery/discoveryIntentConfig";

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

export { DEFAULT_CITY_SLUG };

/** Список городов с городским хабом `/{city}` */
export const VALID_CITY_SLUGS = KNOWN_CITY_SLUGS;

/** Главная страница текущего города-флагмана (первый slug в `VALID_CITY_SLUGS`) */
export const DEFAULT_CITY_HUB_PATH = `/${DEFAULT_CITY_SLUG}`;

export type CitySlug = (typeof VALID_CITY_SLUGS)[number];

export function isCityHubPath(pathname: string | null): boolean {
  if (!pathname) return false;
  const segments = pathname.split("/").filter(Boolean);
  return segments.length === 1 && resolveRouteCitySlug(pathname) !== null;
}

/**
 * Карточка публикации в городе: `/{city}/activity/...`, `/{city}/events/{slug|id}`.
 * (Витрина `/city/events` без slug — не деталь.)
 * Первый сегмент — любой незарезервированный slug (город из витрины), не только KNOWN_CITY_SLUGS.
 */
export function isPublicationDetailPath(pathname: string | null): boolean {
  if (!pathname) return false;
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length < 3) return false;
  const hub = segments[0];
  if (!hub || isReservedTopLevelSegment(hub)) return false;
  const section = segments[1];
  return section === "activity" || section === "events";
}

/**
 * Страница детали маршрута: `/routes/[slug]`.
 * Header не должен быть sticky — уходит вверх при скролле,
 * sticky top action bar управляется самой страницей.
 */
export function isRouteDetailPath(pathname: string | null): boolean {
  if (!pathname) return false;
  const segments = pathname.split("/").filter(Boolean);
  return segments.length === 2 && segments[0] === "routes" && segments[1] !== "new";
}

/**
 * Страницы где header не должен быть sticky.
 * Используется в MobileHeader и Header (desktop).
 */
export function isNonStickyHeaderPath(pathname: string | null): boolean {
  return isPublicationDetailPath(pathname) || isRouteDetailPath(pathname);
}

/**
 * Страницы контента публикаций — без фиксированного mobile bottom bar
 * (статья, место, маршрут, короткая ссылка). Страницы событий — исключение: там bottom bar показываем.
 */
export function shouldHideMobileBottomNav(pathname: string | null): boolean {
  if (!pathname) return false;
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length < 2) return false;

  if (segments[0] === "preview" && segments[1] === "articles") return true;
  if (segments[0] === "blog") return true;
  if (segments[0] === "places") return true;
  if (segments[0] === "offers") return true;
  if (segments[0] === "p") return true;
  // маршруты — bottom nav показываем
  // if (segments[0] === "routes" && segments[1] !== "new") return true;

  /** Превью события в кабинете — полноэкранная карточка, без нижней навигации и FAB «Мой план». */
  if (
    segments[0] === "me" &&
    segments[1] === "events" &&
    segments.length >= 4 &&
    segments[3] === "preview"
  ) {
    return true;
  }

  // Страницы событий /{city}/events/{slug} — bottom bar показываем
  if (isPublicationDetailPath(pathname)) return false;

  return false;
}

/** Админ-панель `/admin` — без виджета «Мой план» и без автo-открытия по URL. */
export function isAdminPanelPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

/** Кабинет бизнеса `/business` — та же backoffice-зона, без продукта «Мой план». */
export function isBusinessPanelPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === "/business" || pathname.startsWith("/business/");
}

/** Админка или бизнес-кабинет. */
export function isBackofficePath(pathname: string | null): boolean {
  return isAdminPanelPath(pathname) || isBusinessPanelPath(pathname);
}

/** Изолированный редактор контента: `/editor`, `/editor/event/new`, … */
export function isContentEditorPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === "/editor" || pathname.startsWith("/editor/");
}

/** Восстановление / сброс пароля — отдельные auth-страницы без виджета «Мой план». */
export function isPasswordRecoveryPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return (
    pathname === "/forgot-password" ||
    pathname.startsWith("/reset-password/")
  );
}

/** Full-page auth-страницы без shell/виджета «Мой план». */
export function isStandaloneAuthPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === "/login" || isPasswordRecoveryPath(pathname);
}

/**
 * Где не монтируется оболочка «Мой план» (FAB/модалки): admin, business, редактор.
 */
export function isMyPlanShellExcludedPath(pathname: string | null): boolean {
  return (
    isBackofficePath(pathname) ||
    isContentEditorPath(pathname) ||
    isStandaloneAuthPath(pathname)
  );
}

/**
 * FAB «Мой план»: скрыть вне публичного shell (admin, business, editor) и там же, где скрыт mobile bottom bar
 * (детали публикаций и т.д.), кроме страниц событий — там виджет показываем.
 */
export function shouldHideMyPlanWidget(pathname: string | null): boolean {
  if (isStandaloneAuthPath(pathname)) return true;
  if (isMyPlanShellExcludedPath(pathname)) return true;
  // На страницах событий виджет показываем
  if (isPublicationDetailPath(pathname)) return false;
  return shouldHideMobileBottomNav(pathname);
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

  if (resolveRouteCitySlug(pathname) === null) {
    return null;
  }

  /** Детальные страницы /city/events/… и т.д. */
  if (segments.length > 2) return null;

  const potentialIntent = segments[1];

  /** Каноническая витрина «Куда пойти» и алиас (редирект на `/events`). */
  if (potentialIntent === "events") return "kuda";
  if (potentialIntent === "kuda") return "kuda";
  if (potentialIntent === "where-to-go") return "kuda";
  if (potentialIntent === "classes") return "classes";
  if (potentialIntent === "birthday") return "birthday";
  if (potentialIntent === "routes") return "routes";

  return null;
}

/**
 * Discovery listing pages only.
 * City hub `/{city}` intentionally excluded: it has discovery-flavored UI,
 * but should not auto-sync listing filters into the URL.
 */
export function isDiscoveryListingPath(pathname: string | null): boolean {
  return getIntentFromPath(pathname) !== null;
}

export function getCityFromPath(pathname: string | null): string | null {
  return resolveRouteCitySlug(pathname);
}
