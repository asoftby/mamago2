/**
 * Расписание занятий в новом мастере (TZ-1 §4, п. «Занятия»): регулярные группы (дни недели + время + мест)
 * или список дат разовых занятий. Чистые функции без Prisma/React.
 *
 * Хранение (решение 8 фазы 0):
 * - регулярные: `OfferBooking.scheduleKind=RECURRING_SESSIONS` + `OfferScheduleRule` (по строке на день);
 * - разовые: `OfferBooking.scheduleKind=DATED_SESSIONS` + `OfferSession` (по строке на дату);
 * - закрытые дни: `OfferScheduleException`.
 * Способ записи при этом не меняется: онлайн-запись по слотам в фазе 1 скрыта.
 */
import { z } from "zod";

export const CLASS_PRODUCT_TYPES = ["ONE_TIME_ACTIVITY", "REGULAR_ACTIVITY"] as const;

export function offerIsClass(productType: string | null | undefined): boolean {
  return productType === "ONE_TIME_ACTIVITY" || productType === "REGULAR_ACTIVITY";
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Группа регулярных занятий: дни недели ISO (1 = Пн … 7 = Вс), время начала, число мест. */
export interface ClassSessionGroup {
  id: string;
  days: number[];
  time: string;
  seats: string;
  /** Отдельный период группы; undefined наследует общий период, null — без границ. */
  period?: { from: string | null; to: string | null } | null;
}

/** Разовое занятие на конкретную дату. */
export interface ClassDateSession {
  id: string;
  date: string;
  time: string;
  seats: string;
}

export interface ClassScheduleForm {
  groups: ClassSessionGroup[];
  dates: ClassDateSession[];
  /** «Курс с началом и концом»: ограничивает все группы по датам. */
  periodFrom: string | null;
  periodTo: string | null;
}

export function defaultClassSchedule(): ClassScheduleForm {
  return { groups: [], dates: [], periodFrom: null, periodTo: null };
}

export function newClassScheduleId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `cls-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function emptyClassGroup(): ClassSessionGroup {
  return { id: newClassScheduleId(), days: [], time: "17:00", seats: "" };
}

export function emptyClassDate(): ClassDateSession {
  return { id: newClassScheduleId(), date: "", time: "12:00", seats: "" };
}

/**
 * Длительность занятия в минутах из текстового поля «Продолжительность» («60 минут», «1.5 часа»,
 * «1 ч 30 мин», «90»). `null` — не удалось понять: партнёр правит поле, текст не подменяем.
 */
export function parseClassDurationMinutes(raw: string | null | undefined): number | null {
  const text = (raw ?? "").trim().toLowerCase().replace(",", ".");
  if (!text) return null;

  const hoursMinutes = /^(\d+(?:\.\d+)?)\s*(?:ч|час\p{L}*|h)\s*(?:(\d+)\s*(?:м|мин\p{L}*|min)?)?$/u.exec(text);
  let minutes: number | null = null;
  if (hoursMinutes) {
    minutes = Math.round(Number(hoursMinutes[1]) * 60 + (hoursMinutes[2] ? Number(hoursMinutes[2]) : 0));
  } else {
    const onlyMinutes = /^(\d+)\s*(?:м|мин\p{L}*|min)?\.?$/u.exec(text);
    if (onlyMinutes) minutes = Number(onlyMinutes[1]);
  }
  if (minutes === null || !Number.isFinite(minutes)) return null;
  return minutes >= 15 && minutes <= 720 ? minutes : null;
}

export function parseSeats(raw: string | null | undefined): number | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 && n <= 1000 ? n : null;
}

export function timeToMinutes(time: string): number | null {
  if (!TIME_RE.test(time)) return null;
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

// ── API-контракт ────────────────────────────────────────────────────────────

const seatsSchema = z.number().int().min(1).max(1000).nullable();
const periodSchema = z.object({
  from: z.string().regex(DATE_RE).nullable(),
  to: z.string().regex(DATE_RE).nullable(),
}).nullable();

export const classScheduleInputSchema = z
  .object({
    kind: z.enum(["recurring", "dated"]),
    durationMin: z.number().int().min(15).max(720),
    groups: z
      .array(
        z.object({
          days: z.array(z.number().int().min(1).max(7)).min(1).max(7),
          time: z.string().regex(TIME_RE),
          seats: seatsSchema,
          period: periodSchema.optional(),
        }),
      )
      .max(30)
      .default([]),
    dates: z
      .array(z.object({ date: z.string().regex(DATE_RE), time: z.string().regex(TIME_RE), seats: seatsSchema }))
      .max(200)
      .default([]),
    period: periodSchema.default(null),
    closedDates: z.array(z.string().regex(DATE_RE)).max(366).default([]),
  })
  .superRefine((value, ctx) => {
    for (const [i, group] of value.groups.entries()) {
      const period = group.period === undefined ? value.period : group.period;
      if (period?.from && period.to && period.to < period.from) {
        ctx.addIssue({ code: "custom", path: ["groups", i, "period"], message: "Конец курса раньше начала" });
      }
      const start = timeToMinutes(group.time);
      if (start !== null && start + value.durationMin > 1440) {
        ctx.addIssue({ code: "custom", path: ["groups", i, "time"], message: "Занятие не должно заканчиваться после полуночи" });
      }
    }
    for (const [i, item] of value.dates.entries()) {
      const start = timeToMinutes(item.time);
      if (start !== null && start + value.durationMin > 1440) {
        ctx.addIssue({ code: "custom", path: ["dates", i, "time"], message: "Занятие не должно заканчиваться после полуночи" });
      }
    }
    if (value.period?.from && value.period.to && value.period.to < value.period.from) {
      ctx.addIssue({ code: "custom", path: ["period"], message: "Конец курса раньше начала" });
    }
  });

export type ClassScheduleInput = z.infer<typeof classScheduleInputSchema>;

/** Форма → тело запроса. `null`, пока длительность не распознана (шаг покажет, чего не хватает). */
export function buildClassScheduleInput(
  form: ClassScheduleForm,
  closedDates: readonly string[],
  productType: string | null | undefined,
  classDuration: string | null | undefined,
): ClassScheduleInput | null {
  if (!offerIsClass(productType)) return null;
  const durationMin = parseClassDurationMinutes(classDuration);
  if (durationMin === null) return null;
  const kind = productType === "REGULAR_ACTIVITY" ? "recurring" : "dated";
  const hasPeriod = Boolean(form.periodFrom || form.periodTo);
  return {
    kind,
    durationMin,
    groups:
      kind === "recurring"
        ? form.groups
            .filter((group) => group.days.length > 0 && TIME_RE.test(group.time))
            .map((group) => ({
              days: [...new Set(group.days)].sort(), time: group.time, seats: parseSeats(group.seats),
              ...(group.period !== undefined ? { period: group.period } : {}),
            }))
        : [],
    dates:
      kind === "dated"
        ? form.dates
            .filter((item) => DATE_RE.test(item.date) && TIME_RE.test(item.time))
            .map((item) => ({ date: item.date, time: item.time, seats: parseSeats(item.seats) }))
        : [],
    period: kind === "recurring" && hasPeriod ? { from: form.periodFrom, to: form.periodTo } : null,
    closedDates: [...new Set(closedDates.filter((date) => DATE_RE.test(date)))].sort(),
  };
}

/** Чего не хватает занятию для публикации расписания. */
export function getClassScheduleMissingFields(
  form: ClassScheduleForm,
  productType: string | null | undefined,
  classDuration: string | null | undefined,
): string[] {
  if (!offerIsClass(productType)) return [];
  const missing: string[] = [];
  const duration = parseClassDurationMinutes(classDuration);
  if (duration === null) missing.push("Продолжительность занятия числом");
  if (productType === "REGULAR_ACTIVITY") {
    const valid = form.groups.filter((group) => group.days.length > 0 && TIME_RE.test(group.time));
    if (valid.length === 0) missing.push("Дни и время занятий");
    if (duration !== null && valid.some((group) => (timeToMinutes(group.time) ?? 0) + duration > 1440)) {
      missing.push("Занятие заканчивается после полуночи");
    }
    const periods = valid.map((group) => group.period === undefined
      ? { from: form.periodFrom, to: form.periodTo } : group.period);
    if (periods.some((period) => period?.from && period.to && period.to < period.from)) missing.push("Даты курса");
  } else {
    const valid = form.dates.filter((item) => DATE_RE.test(item.date) && TIME_RE.test(item.time));
    if (valid.length === 0) missing.push("Даты занятий");
    if (duration !== null && valid.some((item) => (timeToMinutes(item.time) ?? 0) + duration > 1440)) {
      missing.push("Занятие заканчивается после полуночи");
    }
  }
  return missing;
}

// ── строки БД → форма ───────────────────────────────────────────────────────

/** Правила `OfferScheduleRule` → группы формы: одинаковое время/места/период объединяем по дням. */
export function groupsFromRules(
  rules: Array<{
    weekday: number;
    startMinutes: number;
    capacity: number | null;
    validFrom?: Date | string | null;
    validTo?: Date | string | null;
  }>,
): { groups: ClassSessionGroup[]; periodFrom: string | null; periodTo: string | null } {
  const key = (value: Date | string | null | undefined) =>
    value ? (typeof value === "string" ? value : value.toISOString()).slice(0, 10) : null;
  const periodKeys = new Set(rules.map((rule) => JSON.stringify([key(rule.validFrom), key(rule.validTo)])));
  const separatePeriods = periodKeys.size > 1;
  const byKey = new Map<string, ClassSessionGroup>();
  for (const rule of [...rules].sort((a, b) => a.startMinutes - b.startMinutes || a.weekday - b.weekday)) {
    const period = { from: key(rule.validFrom), to: key(rule.validTo) };
    const groupKey = JSON.stringify([rule.startMinutes, rule.capacity, period.from, period.to]);
    const existing = byKey.get(groupKey);
    if (existing) {
      if (!existing.days.includes(rule.weekday)) existing.days.push(rule.weekday);
    } else {
      byKey.set(groupKey, {
        id: newClassScheduleId(),
        days: [rule.weekday],
        time: minutesToTime(rule.startMinutes),
        seats: rule.capacity ? String(rule.capacity) : "",
        ...(separatePeriods ? { period } : {}),
      });
    }
  }
  const first = rules[0];
  return {
    groups: [...byKey.values()].map((group) => ({ ...group, days: [...group.days].sort() })),
    periodFrom: separatePeriods ? null : key(first?.validFrom),
    periodTo: separatePeriods ? null : key(first?.validTo),
  };
}
