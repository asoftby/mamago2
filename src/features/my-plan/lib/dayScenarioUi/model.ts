/**
 * Pure model of the day-scenario draft screen (BACKLOG-230, PR 2): dates, windows, labels,
 * history and request building. No React, no I/O, so every rule here is unit-tested.
 */
import type { DraftItem, DraftRequest, DraftResponse } from "@/server/services/dayScenarioEngine/draft.service";

export type { DraftItem, DraftResponse };
export type ScenarioMode = "walk" | "car";
export type WhenChoice = "today" | "tomorrow" | "weekend" | "other";

const TZ = "Europe/Minsk";
const MINUTE_MS = 60_000;

// ---------- dates ----------

export function addDaysIso(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/** 0 = Sunday ... 6 = Saturday, from a calendar date. */
export function weekdayOf(iso: string): number {
  return new Date(`${iso}T12:00:00Z`).getUTCDay();
}

export const isWeekendIso = (iso: string): boolean => weekdayOf(iso) === 0 || weekdayOf(iso) === 6;

/**
 * "Выходные": Saturday and Sunday of the weekend that is still ahead. On Saturday that is
 * today and tomorrow; on Sunday the day is mostly gone, so the next weekend.
 */
export function weekendDates(todayIso: string): [string, string] {
  const dow = weekdayOf(todayIso);
  const saturday = dow === 6 ? todayIso : addDaysIso(todayIso, (6 - dow + 7) % 7 || 7);
  return [saturday, addDaysIso(saturday, 1)];
}

/** The dates a "when" answer stands for (one day, or the two weekend days). */
export function datesForChoice(choice: WhenChoice, todayIso: string, otherIso: string | null): string[] {
  if (choice === "today") return [todayIso];
  if (choice === "tomorrow") return [addDaysIso(todayIso, 1)];
  if (choice === "weekend") return weekendDates(todayIso);
  return otherIso ? [otherIso] : [];
}

/** Fixed day window from the "просто" mockup: weekdays 16-20, weekends 10-20. */
export function windowFor(iso: string): { dayStart: string; dayEnd: string } {
  return isWeekendIso(iso) ? { dayStart: "10:00", dayEnd: "20:00" } : { dayStart: "16:00", dayEnd: "20:00" };
}

const MONTHS_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const WEEKDAYS = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];
const WEEKDAYS_SHORT = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

/** "Суббота, 14 ноября". */
export function dayTitle(iso: string): string {
  const month = Number(iso.slice(5, 7)) - 1;
  return `${WEEKDAYS[weekdayOf(iso)]}, ${Number(iso.slice(8, 10))} ${MONTHS_GEN[month]}`;
}

/** "Сб · 14 ноября" for the weekend tabs. */
export function dayTabLabel(iso: string): string {
  const month = Number(iso.slice(5, 7)) - 1;
  return `${WEEKDAYS_SHORT[weekdayOf(iso)]} · ${Number(iso.slice(8, 10))} ${MONTHS_GEN[month]}`;
}

/** Next `count` days from today (inclusive), for the "другой день" picker. */
export function upcomingDays(todayIso: string, count = 21): string[] {
  return Array.from({ length: count }, (_, i) => addDaysIso(todayIso, i));
}

// ---------- ages ----------

/** The four age answers of the guest form, mapped to the canonical ranges the engine filters by. */
export const AGE_ANSWERS: { key: string; label: string; ranges: string[] }[] = [
  { key: "u3", label: "до 3", ranges: ["0-1", "1-3"] },
  { key: "3-6", label: "3–6", ranges: ["3-5", "5-7"] },
  { key: "7-10", label: "7–10", ranges: ["7-9", "9-12"] },
  { key: "11p", label: "11+", ranges: ["12-14", "14-16", "16-18"] },
];

export function rangesForAnswers(keys: readonly string[]): string[] {
  return [...new Set(AGE_ANSWERS.filter((a) => keys.includes(a.key)).flatMap((a) => a.ranges))];
}

// ---------- labels ----------

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ }).format(new Date(iso));
}

/** "на машине · 15 мин" / "пешком · 10 мин"; null without a leg. */
export function legLabel(travel: DraftItem["travel"]): string | null {
  if (!travel) return null;
  const minutes = Math.max(1, Math.round(travel.minutes));
  return `${travel.mode === "walk" ? "пешком" : "на машине"} · ${minutes} мин`;
}

/** Small notes under a point: what the parent should double-check. */
export function itemNotes(item: DraftItem): string[] {
  const notes: string[] = [];
  if (item.hoursUnconfirmed) notes.push("уточните часы работы");
  if (item.scheduleUnconfirmed) notes.push("время по расписанию, уточните");
  if (item.approximatePlace) notes.push("примерное место");
  if (item.far) notes.push("далеко — заменить?");
  return notes;
}

const PLACES = ["место", "места", "мест"];
export function pluralPlaces(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  const word = mod10 === 1 && mod100 !== 11 ? PLACES[0]! : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? PLACES[1]! : PLACES[2]!;
  return `${n} ${word}`;
}

/** "3 места · с 10:30 до 17:40". */
export function summaryLine(items: readonly DraftItem[]): string {
  if (items.length === 0) return "";
  const sorted = [...items].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return `${pluralPlaces(items.length)} · с ${formatTime(sorted[0]!.startsAt)} до ${formatTime(sorted[sorted.length - 1]!.endsAt)}`;
}

/** "от 12 BYN" / the free-text price of the card; null when the card carries none. */
export function priceLabel(card: DraftItem["card"]): string | null {
  if (card.priceText?.trim()) return card.priceText.trim();
  if (card.priceFrom == null) return null;
  return `${card.priceTo != null && card.priceTo !== card.priceFrom ? "от " : ""}${card.priceFrom} ${card.currency ?? "BYN"}`;
}

/** "Музей · 3+ · от 12 BYN" from whatever the card carries. */
export function metaLine(card: DraftItem["card"]): string {
  return [card.categoryName, card.ageLabel, priceLabel(card)].filter((part): part is string => Boolean(part)).join(" · ");
}

/** Calendar date (YYYY-MM-DD) of an instant in the Minsk time zone. */
export function isoDateOf(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: TZ }).format(new Date(iso));
}

/** "18:00–19:30". */
export function timeRange(startsAt: string, endsAt: string): string {
  return `${formatTime(startsAt)}–${formatTime(endsAt)}`;
}

/**
 * A swipe that goes "back" like on a phone: it starts at the left edge, travels right far enough and
 * stays mostly horizontal (a vertical scroll that starts near the edge must not count).
 */
export function isEdgeSwipeBack(start: { x: number; y: number }, end: { x: number; y: number }): boolean {
  const dx = end.x - start.x;
  const dy = Math.abs(end.y - start.y);
  return start.x <= 28 && dx >= 64 && dy <= 48 && dx >= dy * 1.5;
}

// ---------- draft state ----------

export type Draft = {
  items: DraftItem[];
  status: DraftResponse["status"];
  suggestMode: DraftResponse["suggestMode"];
  mode: ScenarioMode;
};

export const HISTORY_LIMIT = 5;

export type DraftHistory = {
  current: Draft | null;
  /** Newest first. "Вернуть прошлый" pops the head. */
  past: Draft[];
  /** Counter for "Другой вариант": variant k asks the engine for the k-th deterministic alternative. */
  variant: number;
  /** Every point this day has shown so far (any variant): seen filler places are not offered again. */
  shown: string[];
  /** The engine has no new variant: "Мы показали всё, что подходит". */
  exhausted: boolean;
};

export const emptyHistory = (): DraftHistory => ({ current: null, past: [], variant: 0, shown: [], exhausted: false });

const unionIds = (a: readonly string[], b: readonly string[]) => [...new Set([...a, ...b])];

/** A freshly computed draft becomes current; the previous one is kept for "Вернуть прошлый". */
export function pushDraft(history: DraftHistory, next: Draft, variant = history.variant): DraftHistory {
  const past = history.current && history.current.items.length > 0 ? [history.current, ...history.past].slice(0, HISTORY_LIMIT) : history.past;
  return { current: next, past, variant, shown: unionIds(history.shown, next.items.map((i) => i.activityId)), exhausted: false };
}

export const canGoBack = (history: DraftHistory): boolean => history.past.length > 0;

/** "Вернуть прошлый": no request, the previous draft simply comes back (what was shown stays shown). */
export function popDraft(history: DraftHistory): DraftHistory {
  const [previous, ...rest] = history.past;
  if (!previous) return history;
  return { ...history, current: previous, past: rest, exhausted: false };
}

/** The engine answered "nothing new": keep the draft on screen and say so. */
export function markExhausted(history: DraftHistory): DraftHistory {
  return history.exhausted ? history : { ...history, exhausted: true };
}

/** "Показать заново": forget what was shown, keep the draft, so «Другой вариант» can cycle again. */
export function restartVariants(history: DraftHistory): DraftHistory {
  if (!history.current) return history;
  return { ...history, variant: 0, shown: history.current.items.map((i) => i.activityId), exhausted: false };
}

/**
 * "Убрать": drops one point locally (the engine is not asked); the old draft stays undoable.
 * A travel leg describes the pair (previous point -> this point). When the neighbour changes the leg
 * no longer says anything true, so it is dropped (the first point never has one) rather than shown wrong.
 */
export function removeItem(history: DraftHistory, activityId: string): DraftHistory {
  if (!history.current) return history;
  const before = history.current.items;
  const kept = before.filter((item) => item.activityId !== activityId);
  if (kept.length === before.length) return history;
  const items = kept.map((item, index) => {
    const previousBefore = before[before.findIndex((x) => x.activityId === item.activityId) - 1];
    const unchanged = index > 0 && previousBefore?.activityId === kept[index - 1]!.activityId;
    return unchanged ? item : { ...item, travel: null };
  });
  return pushDraft(history, { ...history.current, items, status: items.length > 0 ? history.current.status : "empty" });
}

/** A chosen alternative replaces the draft by the whole variant the engine computed for it. */
export function applyAlternative(history: DraftHistory, items: DraftItem[]): DraftHistory {
  if (!history.current) return history;
  return pushDraft(history, { ...history.current, items, status: items.length > 0 ? "ok" : "empty" });
}

/** The alternative a variant offers: the point that is not in the current draft. */
export function freshItemOf(variantItems: readonly DraftItem[], currentIds: ReadonlySet<string>, replacedId: string): DraftItem | null {
  return variantItems.find((item) => !currentIds.has(item.activityId) && item.activityId !== replacedId) ?? null;
}

// ---------- requests ----------

export type ScenarioQuery = {
  /** City slug of the page the screen was opened on; the engine's pool is per city. */
  city: string;
  date: string;
  mode: ScenarioMode;
  /** Guest answers; ignored for a signed-in user, who sends `personaIds`. */
  ageRanges: string[];
  personaIds: string[];
};

type DraftRequestInput = Pick<DraftRequest, "date" | "action" | "mode" | "ageRanges" | "personaIds" | "variant" | "targetCount" | "dayStart" | "dayEnd"> &
  Partial<Pick<DraftRequest, "current" | "pinnedActivityIds" | "replaceActivityId" | "city" | "shownActivityIds">>;

export const DEFAULT_TARGET_COUNT = 3;
export const MAX_TARGET_COUNT = 4;

/** Request body for the draft API. Guests send age ranges, members send persona ids. */
export function buildDraftBody(
  query: ScenarioQuery,
  action: DraftRequest["action"],
  options: { variant?: number; items?: readonly DraftItem[]; pinAll?: boolean; targetCount?: number; replaceActivityId?: string; shown?: readonly string[] } = {},
): DraftRequestInput {
  const { dayStart, dayEnd } = windowFor(query.date);
  const items = options.items ?? [];
  return {
    city: query.city,
    date: query.date,
    action,
    mode: query.mode,
    ageRanges: query.personaIds.length > 0 ? [] : query.ageRanges,
    personaIds: query.personaIds,
    variant: options.variant ?? 0,
    targetCount: Math.min(MAX_TARGET_COUNT, Math.max(1, options.targetCount ?? DEFAULT_TARGET_COUNT)),
    dayStart,
    dayEnd,
    current: items.map((item) => ({ activityId: item.activityId, startsAt: item.startsAt })),
    pinnedActivityIds: options.pinAll ? items.map((item) => item.activityId) : [],
    ...(options.replaceActivityId ? { replaceActivityId: options.replaceActivityId } : {}),
    ...(options.shown ? { shownActivityIds: [...options.shown].slice(-100) } : {}),
  };
}

export function toDraft(response: DraftResponse): Draft {
  return { items: response.items, status: response.status, suggestMode: response.suggestMode, mode: response.mode === "walk" ? "walk" : "car" };
}

/** Wall-clock minutes between two ISO instants (non-negative). */
export function minutesBetween(fromIso: string, toIso: string): number {
  return Math.max(0, Math.round((Date.parse(toIso) - Date.parse(fromIso)) / MINUTE_MS));
}

/**
 * "С кем идём?" starts from the page's "Для кого?" choice: the people chosen there that are in this
 * family. Nobody chosen (or everybody) is the "Все" chip, which is the empty selection.
 */
export function initialPersonSelection(peopleIds: readonly string[], pageSelectedIds: readonly string[]): string[] {
  const chosen = pageSelectedIds.filter((id, index, all) => peopleIds.includes(id) && all.indexOf(id) === index);
  return chosen.length === peopleIds.length ? [] : chosen;
}

/**
 * Public page of a point of the draft. It lives under the city the item is published in
 * (`card.citySlug`): the pool also holds items of cities below the listing city, and a slug can exist in
 * both. An event whose city is unknown opens by id (globally unique) under the listing city; a place
 * falls back to the listing city. null when no safe path can be made (the card is then not a link).
 */
export function itemHref(item: Pick<DraftItem, "kind" | "activityId" | "card">, listingCity: string | undefined): string | null {
  const safeCity = (value: string | null | undefined) => (value && /^[a-z-]+$/i.test(value) ? value : null);
  const slug = (item.card.slug ?? "").trim();
  if (slug.includes("/")) return null;
  const own = safeCity(item.card.citySlug);
  if (item.kind === "event") {
    if (own && slug) return `/${own}/events/${encodeURIComponent(slug)}`;
    const city = own ?? safeCity(listingCity);
    return city ? `/${city}/events/${encodeURIComponent(item.activityId)}` : null;
  }
  const city = own ?? safeCity(listingCity);
  return city && slug ? `/${city}/places/${encodeURIComponent(slug)}` : null;
}

/** Entry label of the widget button: a day with something in it is "extended", an empty one "built". */
export function entryLabel(hasPlanItems: boolean): "Собрать день" | "Дополнить день" {
  return hasPlanItems ? "Дополнить день" : "Собрать день";
}
