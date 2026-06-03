import {
  getIntentFromPath,
  isCityHubPath,
  isPublicationDetailPath,
  isPlaceDetailPath,
  isRouteDetailPath,
  isProgramDetailPath,
} from "@/lib/intent";

export type SiteHeaderVariant = "discovery" | "landing";

/**
 * - **discovery** — полная строка поиска (Где / Когда / Для кого) и кнопка «Фильтры» там, где предусмотрено.
 * - **landing** — только лого, табы разделов, иконки (поиск / уведомления / профиль); без поисковой капсулы и без фильтров.
 *
 * Не используем landing на витринах `/{city}/kuda`, `/{city}/events`, … на хабе города `/{city}`
 * и на карточках `/{city}/events/{slug}`, `/{city}/activity/...` (тот же хедер, что и в каталоге).
 */
export function getSiteHeaderVariant(pathname: string | null): SiteHeaderVariant {
  if (!pathname) return "discovery";

  // Посадочные детальные страницы — всегда landing, даже если intent определился
  if (isPublicationDetailPath(pathname)) return "landing"; // /{city}/events|activity|offers/[slug]
  if (isPlaceDetailPath(pathname)) return "landing";        // /places/[s] + /{city}/places/[s]
  if (isRouteDetailPath(pathname)) return "landing";        // /routes/[slug]
  if (isProgramDetailPath(pathname)) return "landing";      // /{city}/programs/[slug]

  if (getIntentFromPath(pathname) !== null) return "discovery";
  if (isCityHubPath(pathname)) return "discovery";

  const segments = pathname.split("/").filter(Boolean);
  const first = segments[0];

  if (first === "preview") return "landing";
  if (first === "blog") return "landing";
  if (first === "places") return "landing";
  if (first === "offers") return "landing";
  if (first === "p") return "landing";
  if (first === "routes") return "landing";
  if (first === "ideas") return "landing";
  /** Маркетинговая посадочная «День рождения» (не витрина `/{city}/birthday`) */
  if (first === "birthday" && segments.length === 1) return "landing";

  return "discovery";
}
