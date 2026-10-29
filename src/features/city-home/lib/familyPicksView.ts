import type { FamilyPicksResponse } from "@/server/services/recommendations/familyPicks/load";

export const FAMILY_PICKS_PLACEMENT = "HOME_FOR_FAMILY";

/** Подзаголовок блока по окну показа. */
export function familyPicksSubtitle(mode: FamilyPicksResponse["window"]["mode"]): string {
  return mode === "WEEKEND" ? "На эти выходные" : "На этой неделе";
}

/**
 * Заголовок блока. Гость видит «Популярно в Минске» (честно: персонализации нет),
 * остальные — заголовок уровня из ответа сервера.
 */
export function familyPicksTitle(input: {
  audience: FamilyPicksResponse["audience"];
  level: FamilyPicksResponse["level"];
  serverTitle: string | null;
  cityLocative: string;
}): string | null {
  if (input.level === "NONE") return null;
  if (input.audience === "guest") return `Популярно ${input.cityLocative}`;
  return input.serverTitle;
}

/** Приглашение заполнить профиль показываем, пока выдача не персональная (fallback POPULAR). */
export function shouldInviteToProfile(level: FamilyPicksResponse["level"]): boolean {
  return level === "POPULAR";
}

/** Ссылка «Другие идеи» → «Куда пойти» с возрастным фильтром детей. */
export function otherIdeasHref(input: {
  citySlug: string;
  ageFilter: readonly string[];
  mode: FamilyPicksResponse["window"]["mode"];
}): string {
  const params = new URLSearchParams();
  if (input.ageFilter.length > 0) params.set("age", input.ageFilter.join(","));
  const qs = params.toString();
  return `/${input.citySlug}/events${qs ? `?${qs}` : ""}`;
}

/** Мета события, отправляемая с показом/действием карточки блока. */
export function familyPickAnalyticsMeta(input: {
  level: FamilyPicksResponse["level"];
  runId: string | null;
  item: { exposureId: string | null; position: number; reasonCodes: readonly string[] };
}): Record<string, unknown> {
  return {
    source: "recommendation",
    section: "home",
    placement: FAMILY_PICKS_PLACEMENT,
    personalizationLevel: input.level,
    reasonCodes: [...input.item.reasonCodes],
    position: input.item.position,
    recommendationSurface: "home",
    ...(input.runId ? { recommendationRunId: input.runId } : {}),
    ...(input.item.exposureId ? { recommendationExposureId: input.item.exposureId } : {}),
  };
}

const DISMISSED_KEY = "mg_family_picks_dismissed";

/** Локальная память «Не подходит» для гостя (сервер для гостя исключает по anonymousId тоже). */
export function readDismissedIds(): string[] {
  try {
    const raw = window.localStorage.getItem(DISMISSED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string").slice(-200) : [];
  } catch {
    return [];
  }
}

export function rememberDismissedId(id: string): void {
  try {
    const next = [...new Set([...readDismissedIds(), id])].slice(-200);
    window.localStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
  } catch {
    /* память недоступна — достаточно серверного события */
  }
}
