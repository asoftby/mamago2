import { KNOWN_CITY_SLUGS } from "@/lib/city/cityDisplayNames";
import {
  DEFAULT_CITY_SLUG,
  isReservedTopLevelSegment,
} from "@/lib/city/resolveCityContext";

/** Куда уводим непокрытый WP-хвост: хаб города-флагмана. */
export const WP_LEGACY_CATCH_ALL_DESTINATION = `/${DEFAULT_CITY_SLUG}`;

/**
 * Верхнеуровневые сегменты, за которыми стоят реальные роуты приложения.
 * Middleware работает на Edge (без fs), поэтому список статический;
 * синхронизацию с src/app проверяет wpLegacyCatchAll.test.ts.
 */
export const KNOWN_ROOT_SEGMENTS = [
  "account",
  "actions",
  "admin",
  "api",
  "auth",
  "blog",
  "business",
  "business-entry",
  "editor",
  "forgot-password",
  "ideas",
  "identity",
  "invite",
  "legal",
  "login",
  "me",
  "n",
  "notifications",
  "offers",
  "p",
  "page",
  "places",
  "preview",
  "profile",
  "profile-entry",
  "register",
  "reset-password",
  "routes",
  "search",
  "settings",
  "u",
  "ui-lab",
  "ui-lab-admin",
  "ui-test",
] as const;

const KNOWN_ROOT_SEGMENT_SET: ReadonlySet<string> = new Set(KNOWN_ROOT_SEGMENTS);
const KNOWN_CITY_SLUG_SET: ReadonlySet<string> = new Set(
  KNOWN_CITY_SLUGS.map((slug) => slug.toLowerCase()),
);

/**
 * WP-миграционный catch-all: пути, не покрытые ни manifest.csv (config
 * redirects отрабатывают ДО middleware), ни одним реальным роутом, получают
 * 301 на хаб вместо 404 — хвост WordPress за пределами манифеста.
 *
 * НЕ редиректим (остаётся обычный 404):
 * - известные секции и города — их поддеревья сами отвечают за свои 404;
 * - reserved-сегменты (api, _next, …);
 * - asset-подобные пути (сегмент с точкой) — matcher их и так не пускает.
 */
export function isWpLegacyCatchAllPath(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return false;

  const first = segments[0].toLowerCase();
  if (first.includes(".") || (segments[segments.length - 1] ?? "").includes(".")) {
    return false;
  }
  if (isReservedTopLevelSegment(first)) return false;
  if (KNOWN_ROOT_SEGMENT_SET.has(first)) return false;
  if (KNOWN_CITY_SLUG_SET.has(first)) return false;

  return true;
}
