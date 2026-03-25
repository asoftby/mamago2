/**
 * Предустановленные периоды агрегации publication.stats (не date picker).
 */

export type PublicationStatsPeriod =
  | "today"
  | "yesterday"
  | "week"
  | "month"
  | "threeMonths"
  | "sixMonths"
  | "year";

export const PUBLICATION_STATS_PERIODS: readonly PublicationStatsPeriod[] = [
  "today",
  "yesterday",
  "week",
  "month",
  "threeMonths",
  "sixMonths",
  "year",
] as const;

export const DEFAULT_PUBLICATION_STATS_PERIOD: PublicationStatsPeriod = "week";

/** Подписи для UI (русский) */
export const PUBLICATION_STATS_PERIOD_LABEL_RU: Record<
  PublicationStatsPeriod,
  string
> = {
  today: "сегодня",
  yesterday: "вчера",
  week: "неделя",
  month: "месяц",
  threeMonths: "3 мес.",
  sixMonths: "6 мес.",
  year: "год",
};

export function parsePublicationStatsPeriod(
  raw: string | null | undefined
): PublicationStatsPeriod | null {
  if (!raw) return null;
  return PUBLICATION_STATS_PERIODS.includes(raw as PublicationStatsPeriod)
    ? (raw as PublicationStatsPeriod)
    : null;
}

/** Человекочитаемое окно для debug.aggregationWindow */
export function periodToAggregationWindowLabel(
  period: PublicationStatsPeriod
): string {
  const map: Record<PublicationStatsPeriod, string> = {
    today: "rolling 1d",
    yesterday: "calendar 1d (вчера)",
    week: "rolling 7d",
    month: "rolling 30d",
    threeMonths: "rolling 90d",
    sixMonths: "rolling 180d",
    year: "rolling 365d",
  };
  return map[period];
}
