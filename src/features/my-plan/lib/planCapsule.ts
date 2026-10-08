/**
 * Модель капсулы «Мой план» (низ мобильного экрана и десктопный виджет).
 * Чистая функция: все тексты и состояния считаются из уже загруженной сводки плана.
 */

export type PlanCapsuleItem = {
  date: string;
  startsAt: Date | string | null;
  title: string | null;
  activityTitle?: string | null;
};

export type PlanCapsuleInput = {
  /** Ближайшие пункты ближайшей даты (из /api/save/plan/summary). */
  nearestItems: PlanCapsuleItem[];
  /** Количество будущих пунктов по датам (прошедшие сегодня сводка уже не включает). */
  countsByDate: Record<string, number>;
  todayIso: string;
  now?: Date;
};

export type PlanCapsuleDateBubble = { weekday: string; day: number };

export type PlanCapsuleModel =
  | { kind: "empty"; ariaLabel: string }
  | {
      kind: "events";
      /** Подпись над названием: «Сегодня · 18:30», «Сегодня 18:30 · ещё 3», «Через 12 дней». */
      caption: string;
      title: string;
      bubble: PlanCapsuleDateBubble;
      /** Дата следующего события (стопка кружков) — только если оно в другой день. */
      stackedNext: PlanCapsuleDateBubble | null;
      /** Бейдж-счётчик на кружке: несколько событий сегодня. */
      badgeCount: number | null;
      ariaLabel: string;
    };

const WEEKDAYS_SHORT = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"] as const;
const MONTHS_GENITIVE = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
] as const;

const NEAR_DAYS = 7;

function parseIso(iso: string): Date {
  return new Date(`${iso}T12:00:00`);
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.UTC(+fromIso.slice(0, 4), +fromIso.slice(5, 7) - 1, +fromIso.slice(8, 10));
  const to = Date.UTC(+toIso.slice(0, 4), +toIso.slice(5, 7) - 1, +toIso.slice(8, 10));
  return Math.round((to - from) / 86_400_000);
}

function pluralDays(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} день`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} дня`;
  return `${n} дней`;
}

function pluralEvents(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} событие`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} события`;
  return `${n} событий`;
}

function toMs(value: Date | string | null): number | null {
  if (value == null) return null;
  const ms = (value instanceof Date ? value : new Date(value)).getTime();
  return Number.isNaN(ms) ? null : ms;
}

export function formatCapsuleTime(value: Date | string | null): string | null {
  const ms = toMs(value);
  if (ms == null) return null;
  return new Date(ms).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

export function toDateBubble(iso: string): PlanCapsuleDateBubble {
  const d = parseIso(iso);
  return { weekday: WEEKDAYS_SHORT[d.getDay()]!, day: d.getDate() };
}

/** «Сегодня» / «Завтра» / «Сб» (в пределах 7 дней) / «Через 12 дней». */
function dayLabel(dateIso: string, todayIso: string): string {
  const diff = daysBetween(todayIso, dateIso);
  if (diff <= 0) return "Сегодня";
  if (diff === 1) return "Завтра";
  if (diff <= NEAR_DAYS) {
    const wd = WEEKDAYS_SHORT[parseIso(dateIso).getDay()]!;
    return wd.charAt(0).toUpperCase() + wd.slice(1);
  }
  return `Через ${pluralDays(diff)}`;
}

function ariaWhen(dateIso: string, todayIso: string, time: string | null): string {
  const diff = daysBetween(todayIso, dateIso);
  const d = parseIso(dateIso);
  const day =
    diff <= 0 ? "сегодня" : diff === 1 ? "завтра" : `${d.getDate()} ${MONTHS_GENITIVE[d.getMonth()]}`;
  return time ? `${day} в ${time}` : day;
}

export function buildPlanCapsuleModel(input: PlanCapsuleInput): PlanCapsuleModel {
  const nowMs = (input.now ?? new Date()).getTime();
  const { todayIso, countsByDate } = input;

  // Показываем ближайшее НЕ прошедшее: сегодняшние пункты с временем раньше «сейчас» отбрасываем.
  const upcoming = input.nearestItems
    .filter((item) => {
      if (item.date < todayIso) return false;
      const ms = toMs(item.startsAt);
      return item.date > todayIso || ms == null || ms >= nowMs;
    })
    .sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      const am = toMs(a.startsAt);
      const bm = toMs(b.startsAt);
      if (am == null && bm == null) return 0;
      if (am == null) return 1;
      if (bm == null) return -1;
      return am - bm;
    });

  const first = upcoming[0];
  if (!first) return { kind: "empty", ariaLabel: "Мой план пуст" };

  const title = first.title?.trim() || first.activityTitle?.trim() || "Без названия";
  const time = formatCapsuleTime(first.startsAt);
  const dayCount = countsByDate[first.date] ?? upcoming.filter((i) => i.date === first.date).length;
  const total = Math.max(
    Object.entries(countsByDate)
      .filter(([date]) => date >= todayIso)
      .reduce((sum, [, n]) => sum + n, 0),
    upcoming.length,
  );
  const rest = Math.max(total - 1, 0);
  const isToday = first.date === todayIso;
  const label = dayLabel(first.date, todayIso);

  const base = {
    title,
    bubble: toDateBubble(first.date),
    ariaLabel: `Мой план: ${title}, ${ariaWhen(first.date, todayIso, time)}`,
  };

  // Несколько событий сегодня → один кружок с бейджем.
  if (isToday && dayCount > 1) {
    return {
      kind: "events",
      ...base,
      title: time ? `${time} ${title}` : title,
      caption: `Сегодня · ${pluralEvents(dayCount)}`,
      stackedNext: null,
      badgeCount: dayCount,
    };
  }

  // Несколько событий в разные дни → «стопка» кружков и «ещё N».
  if (rest > 0) {
    const moreText = `ещё ${rest > 9 ? "9+" : rest}`;
    const nextDate =
      dayCount > 1
        ? null
        : Object.keys(countsByDate)
            .filter((date) => date > first.date && (countsByDate[date] ?? 0) > 0)
            .sort()[0] ?? null;
    const near = daysBetween(todayIso, first.date) <= NEAR_DAYS;
    const when = near ? [label, time].filter(Boolean).join(" ") : label;
    return {
      kind: "events",
      ...base,
      caption: `${when} · ${moreText}`,
      stackedNext: nextDate ? toDateBubble(nextDate) : null,
      badgeCount: null,
    };
  }

  // Одно событие.
  const near = daysBetween(todayIso, first.date) <= NEAR_DAYS;
  return {
    kind: "events",
    ...base,
    caption: near && time ? `${label} · ${time}` : label,
    stackedNext: null,
    badgeCount: null,
  };
}
