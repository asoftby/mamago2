import { formatRuShortDayMonthRange } from "@/lib/formatters/date";
import type { IdeaItem } from "@/app/(public)/me/ideas/types";

export function pluralRu(n: number, one: string, few: string, many: string): string {
  const m = n % 10;
  const h = n % 100;
  return m === 1 && h !== 11 ? one : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? few : many;
}

export function ideasWord(n: number): string {
  return `${n} ${pluralRu(n, "идея", "идеи", "идей")}`;
}

/** Тип идеи для кикера карточки: «Статья · Каникулы». */
export function ideaKindLabel(idea: IdeaItem): string {
  switch (idea.ideaType) {
    case "ARTICLE":
      return "Статья";
    case "ROUTE":
      return "Маршрут";
    case "OFFER":
      if (idea.activity.campProgramType) return "Лагерь";
      return idea.activity.kind === "CLASS" ? "Занятие" : "Предложение";
    default:
      return idea.activity.type === "PLACE" ? "Место" : "Событие";
  }
}

/** Вторая строка карточки (mono): дата и место/адрес. */
export function ideaMetaLine(idea: IdeaItem): string | null {
  const a = idea.activity;
  const date =
    idea.ideaType === "ACTIVITY" && a.dateStart
      ? formatRuShortDayMonthRange(a.dateStart, a.dateEnd ?? null)
      : idea.ideaType === "OFFER"
        ? (a.dateLabel ?? null)
        : null;
  const place = a.placeTitle ?? a.addressLabel ?? null;
  return [date, place].filter(Boolean).join(" · ") || null;
}

export function isPastIdea(idea: IdeaItem): boolean {
  return idea.ideaType === "ACTIVITY" && idea.activity.temporalState === "PAST";
}

const TONES = ["#7E9A6A", "#5E7FA8", "#B07A55", "#8C94C4", "#C98A6B", "#6FA39A"] as const;

/** Стабильный фон обложки для идей без картинки. */
export function toneForIdea(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return TONES[hash % TONES.length]!;
}

export type CollectionSort = "new" | "az" | "big";

export function sortCollections<T extends { title: string; index: number; count: number }>(collections: T[], sort: CollectionSort): T[] {
  const list = [...collections];
  if (sort === "az") return list.sort((a, b) => a.title.localeCompare(b.title, "ru"));
  if (sort === "big") return list.sort((a, b) => b.count - a.count || b.index - a.index);
  return list.sort((a, b) => b.index - a.index);
}
