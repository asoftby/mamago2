import { formatJournalPublishedDate } from "@/lib/article/formatJournalPublishedDate";
import { pluralRu } from "@/lib/text/pluralRu";

/** Тип-фильтр ленты журнала через query-параметр `?type=` (чипов типов нет). */
export type JournalTypeFilter = "ARTICLE" | "COLLECTION" | "BREAKING_NEWS";

export function parseJournalTypeFilter(value: string | string[] | null | undefined): JournalTypeFilter | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "article") return "ARTICLE";
  if (raw === "collection" || raw === "collections") return "COLLECTION";
  if (raw === "news") return "BREAKING_NEWS";
  return null;
}

export function journalTypeFilterParam(type: JournalTypeFilter): string {
  return type === "BREAKING_NEWS" ? "news" : type === "COLLECTION" ? "collections" : "article";
}

/** Лента с фильтром по типу: тот же путь + `type=` (сохраняет существующий query, напр. `tag`). */
export function journalTypeFilterHref(basePath: string, type: JournalTypeFilter): string {
  return `${basePath}${basePath.includes("?") ? "&" : "?"}type=${journalTypeFilterParam(type)}`;
}

export const JOURNAL_TYPE_FILTER_TITLE: Record<JournalTypeFilter, string> = {
  ARTICLE: "Статьи",
  COLLECTION: "Подборки mamaGo",
  BREAKING_NEWS: "Новости",
};

const MINSK_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Minsk",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function minskDayNumber(date: Date): number {
  const [y, m, d] = MINSK_DAY.format(date).split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** Относительное время для новостей: «15 мин», «2 ч», «вчера», иначе дата. */
export function formatJournalRelativeTime(value: Date | string, now: Date = new Date()): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) return formatJournalPublishedDate(date, now);
  const dayDiff = minskDayNumber(now) - minskDayNumber(date);
  if (dayDiff === 0) {
    const minutes = Math.floor(diffMs / 60_000);
    if (minutes < 60) return `${Math.max(1, minutes)} мин`;
    return `${Math.floor(minutes / 60)} ч`;
  }
  if (dayDiff === 1) return "вчера";
  return formatJournalPublishedDate(date, now);
}

/** Мета подборки: «10 событий», если все элементы — события, иначе «10 мест». */
export function formatCollectionMeta(itemCount: number, eventCount: number): string {
  if (itemCount > 0 && eventCount === itemCount) {
    return `${itemCount} ${pluralRu(itemCount, "событие", "события", "событий")}`;
  }
  return `${itemCount} ${pluralRu(itemCount, "место", "места", "мест")}`;
}
