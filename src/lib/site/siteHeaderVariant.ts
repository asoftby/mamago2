import {
  getIntentFromPath,
  isCityHubPath,
  isPublicationDetailPath,
} from "@/lib/intent";

export type SiteHeaderVariant = "discovery" | "landing";

/**
 * - **discovery** — полная строка поиска (Где / Когда / Для кого) и кнопка «Фильтры» там, где предусмотрено.
 * - **landing** — только лого, табы разделов, иконки (поиск / уведомления / профиль); без поисковой капсулы и без фильтров.
 *
 * Не используем landing на витринах `/{city}/kuda`, `/{city}/events`, … и на хабе города `/{city}`.
 */
export function getSiteHeaderVariant(pathname: string | null): SiteHeaderVariant {
  if (!pathname) return "discovery";

  if (getIntentFromPath(pathname) !== null) return "discovery";
  if (isCityHubPath(pathname)) return "discovery";
  /** Детальная карточка события/активности — посадочный хедер без второй строки поиска */
  if (isPublicationDetailPath(pathname)) return "landing";

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
