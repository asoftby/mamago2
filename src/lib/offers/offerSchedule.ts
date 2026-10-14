/**
 * Расписание предложения в новом мастере (шаг «Расписание», фаза 1 TZ-1):
 * способ записи, режим работы и закрытые дни. Чистые функции без Prisma/React —
 * общий контракт формы, API и тестов.
 *
 * Хранение (решение 8 фазы 0):
 * - режим работы и закрытые дни — `OpeningHours` + `OpeningHoursException` оффера
 *   (`Offer.openingHoursId`, `inheritPlaceOpeningHours=false`);
 * - способ записи — `Offer.bookingEnabled` + `Offer.bookingMode`; ссылка внешней записи —
 *   `OfferBooking.externalKind/externalUrl`.
 */
import { z } from "zod";
import type { DayOfWeek } from "@prisma/client";
import type { OpeningHoursData } from "@/components/openingHours/openingHours.types";

export const OFFER_BOOKING_METHODS = ["NONE", "REQUEST_ONLY", "EXTERNAL"] as const;
export type OfferBookingMethod = (typeof OFFER_BOOKING_METHODS)[number];

export const OFFER_EXTERNAL_KINDS = ["WEBSITE", "TICKETS"] as const;
export type OfferExternalKind = (typeof OFFER_EXTERNAL_KINDS)[number];

/** Прежние режимы записи («По расписанию»): показываем как есть, не перезаписываем. */
export type OfferLegacyBookingMode = "USE_PUBLICATION_DATES" | "USE_PUBLICATION_SLOTS";

export const DAYS_ORDER: readonly DayOfWeek[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface OfferScheduleForm {
  /** null — способ записи ещё не выбран (или прежний режим, см. `legacyBookingMode`). */
  bookingMethod: OfferBookingMethod | null;
  legacyBookingMode: OfferLegacyBookingMode | null;
  externalKind: OfferExternalKind;
  externalUrl: string;
  /** `place` — берём график места; `own` — свой график оффера (нужен для закрытых дней). */
  hoursSource: "place" | "own";
  hours: OpeningHoursData;
  /** Закрытые целиком даты, `YYYY-MM-DD`. */
  closedDates: string[];
}

export function defaultOfferHours(timezone = "Europe/Minsk"): OpeningHoursData {
  return {
    mode: "WEEKLY",
    timezone,
    rules: DAYS_ORDER.map((dayOfWeek) => ({
      dayOfWeek,
      isOpen: false,
      allDay: false,
      intervals: [],
    })),
  };
}

export function defaultOfferSchedule(): OfferScheduleForm {
  return {
    bookingMethod: null,
    legacyBookingMode: null,
    externalKind: "WEBSITE",
    externalUrl: "",
    hoursSource: "place",
    hours: defaultOfferHours(),
    closedDates: [],
  };
}

/** Типы, у которых есть «режим работы» (место/праздник). У занятий и лагерей своё расписание. */
export function offerUsesOpeningHours(productType: string | null | undefined): boolean {
  return productType === "PLACE_VISIT" || productType === "PARTY_SERVICE" || productType === "PARTY_PACKAGE";
}

/** Закрытые дни есть у всех, кроме лагеря (TZ-1 §4). */
export function offerUsesClosedDays(productType: string | null | undefined): boolean {
  return productType !== "CAMP" && productType != null;
}

// ── способ записи ↔ колонки Offer ───────────────────────────────────────────

export function bookingColumnsForMethod(method: OfferBookingMethod): {
  bookingEnabled: boolean;
  bookingMode: OfferBookingMethod;
} {
  // Только REQUEST_ONLY включает `bookingEnabled`: по нему booking.service создаёт BookingRequest.
  // NONE и EXTERNAL заявок не создают.
  return { bookingEnabled: method === "REQUEST_ONLY", bookingMode: method };
}

export function bookingMethodFromColumns(offer: {
  bookingEnabled?: boolean | null;
  bookingMode?: string | null;
}): { method: OfferBookingMethod | null; legacy: OfferLegacyBookingMode | null } {
  const mode = offer.bookingMode ?? null;
  if (mode === "USE_PUBLICATION_DATES" || mode === "USE_PUBLICATION_SLOTS") {
    return { method: null, legacy: mode };
  }
  if (mode === "NONE" || mode === "EXTERNAL") return { method: mode, legacy: null };
  if (mode === "REQUEST_ONLY") return { method: "REQUEST_ONLY", legacy: null };
  // bookingEnabled без режима — прежняя запись «по заявке».
  if (offer.bookingEnabled) return { method: "REQUEST_ONLY", legacy: null };
  return { method: null, legacy: null };
}

// ── режим работы: простой вид ───────────────────────────────────────────────

export interface SimpleHours {
  days: DayOfWeek[];
  from: string;
  to: string;
}

export function hoursFromSimple(simple: SimpleHours, timezone = "Europe/Minsk"): OpeningHoursData {
  const open = new Set(simple.days);
  return {
    mode: "WEEKLY",
    timezone,
    rules: DAYS_ORDER.map((dayOfWeek) =>
      open.has(dayOfWeek)
        ? {
            dayOfWeek,
            isOpen: true,
            allDay: false,
            intervals: [{ startTime: simple.from, endTime: simple.to }],
          }
        : { dayOfWeek, isOpen: false, allDay: false, intervals: [] },
    ),
  };
}

/** Один и тот же интервал во все открытые дни → простой вид; иначе `null` («разное время по дням»). */
export function simpleFromHours(hours: OpeningHoursData): SimpleHours | null {
  if (hours.mode !== "WEEKLY") return null;
  const openRules = hours.rules.filter((rule) => rule.isOpen);
  if (openRules.some((rule) => rule.allDay || rule.intervals.length !== 1)) return null;
  if (openRules.length === 0) return { days: [], from: "10:00", to: "20:00" };
  const { startTime, endTime } = openRules[0].intervals[0];
  const same = openRules.every(
    (rule) => rule.intervals[0].startTime === startTime && rule.intervals[0].endTime === endTime,
  );
  if (!same) return null;
  return { days: DAYS_ORDER.filter((day) => openRules.some((rule) => rule.dayOfWeek === day)), from: startTime, to: endTime };
}

// ── закрытые дни ────────────────────────────────────────────────────────────

export function isValidDateKey(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function normalizeClosedDates(dates: readonly string[]): string[] {
  return [...new Set(dates.filter(isValidDateKey))].sort();
}

export function toggleClosedDate(dates: readonly string[], date: string): string[] {
  return dates.includes(date) ? dates.filter((item) => item !== date) : normalizeClosedDates([...dates, date]);
}

// ── API-контракт ────────────────────────────────────────────────────────────

const dayOfWeekSchema = z.enum(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]);
const timeSchema = z.string().regex(TIME_RE);

export const offerScheduleInputSchema = z
  .object({
    /** Не передан — способ записи не меняется (в т.ч. прежние режимы «По расписанию»). */
    bookingMethod: z.enum(OFFER_BOOKING_METHODS).optional(),
    external: z
      .object({
        kind: z.enum(OFFER_EXTERNAL_KINDS),
        url: z.string().trim().max(2000),
      })
      .nullable()
      .optional(),
    hours: z
      .discriminatedUnion("source", [
        z.object({ source: z.literal("place") }),
        z.object({
          source: z.literal("own"),
          data: z.object({
            mode: z.enum(["WEEKLY", "ALWAYS_OPEN", "BY_APPOINTMENT", "TEMPORARILY_CLOSED"]),
            timezone: z.string().min(1).max(64),
            note: z.string().max(500).optional(),
            rules: z
              .array(
                z.object({
                  dayOfWeek: dayOfWeekSchema,
                  isOpen: z.boolean(),
                  allDay: z.boolean(),
                  intervals: z.array(z.object({ startTime: timeSchema, endTime: timeSchema })).max(2),
                }),
              )
              .max(7),
          }),
          closedDates: z.array(z.string().regex(DATE_RE)).max(366),
        }),
      ])
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (value.bookingMethod === "EXTERNAL") {
      const check = validateExternalUrl(value.external?.url ?? "");
      if (check) ctx.addIssue({ code: "custom", path: ["external", "url"], message: check });
    }
  });

export type OfferScheduleInput = z.infer<typeof offerScheduleInputSchema>;

/** `null` — ссылка корректна; иначе текст ошибки. Только http(s) с хостом. */
export function validateExternalUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return "Укажите ссылку";
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "Ссылка должна начинаться с https://";
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return "Ссылка должна начинаться с https://";
  if (!url.hostname.includes(".")) return "Проверьте адрес ссылки";
  return null;
}

/** Форма → тело запроса. Прежний режим записи и «график места» без изменений не отправляем. */
export function buildScheduleInput(
  form: OfferScheduleForm,
  productType: string | null | undefined,
): OfferScheduleInput {
  const input: OfferScheduleInput = {};

  if (form.bookingMethod) {
    input.bookingMethod = form.bookingMethod;
    input.external =
      form.bookingMethod === "EXTERNAL"
        ? { kind: form.externalKind, url: form.externalUrl.trim() }
        : null;
  }

  if (offerUsesClosedDays(productType) || offerUsesOpeningHours(productType)) {
    // Закрытые дни живут в собственном `OpeningHours` оффера: график места не трогаем.
    const wantsOwn =
      form.hoursSource === "own" || (form.closedDates.length > 0 && !offerUsesOpeningHours(productType));
    if (wantsOwn) {
      input.hours = {
        source: "own",
        data: form.hours,
        closedDates: normalizeClosedDates(form.closedDates),
      };
    } else if (offerUsesOpeningHours(productType)) {
      input.hours = { source: "place" };
    }
  }

  return input;
}

/** PATCH only changed schedule subfields. Editing booking must not rewrite stale hours
 * and editing an unrelated section must not rewrite either relation. */
export function buildChangedScheduleInput(
  current: OfferScheduleForm,
  previous: OfferScheduleForm,
  productType: string | null | undefined,
): OfferScheduleInput | undefined {
  const full = buildScheduleInput(current, productType);
  const bookingChanged = current.bookingMethod !== previous.bookingMethod ||
    (current.bookingMethod === "EXTERNAL" &&
      (current.externalKind !== previous.externalKind ||
        current.externalUrl.trim() !== previous.externalUrl.trim()));
  const hoursChanged = current.hoursSource !== previous.hoursSource ||
    JSON.stringify(current.hours) !== JSON.stringify(previous.hours) ||
    JSON.stringify(normalizeClosedDates(current.closedDates)) !==
      JSON.stringify(normalizeClosedDates(previous.closedDates));
  const patch: OfferScheduleInput = {};
  if (bookingChanged && full.bookingMethod) {
    patch.bookingMethod = full.bookingMethod;
    patch.external = full.external;
  }
  if (hoursChanged) {
    if (full.hours) patch.hours = full.hours;
    else if (offerUsesClosedDays(productType) && previous.closedDates.length > 0) {
      // Clearing the last closed date must remove previously saved exceptions.
      patch.hours = { source: "own", data: current.hours, closedDates: [] };
    }
  }
  return Object.keys(patch).length ? patch : undefined;
}

// ── валидация шага ──────────────────────────────────────────────────────────

export function getScheduleMissingFields(
  form: OfferScheduleForm,
  productType: string | null | undefined,
): string[] {
  const missing: string[] = [];
  if (!form.bookingMethod && !form.legacyBookingMode) missing.push("Способ записи");
  if (form.bookingMethod === "EXTERNAL" && validateExternalUrl(form.externalUrl)) {
    missing.push("Ссылка для записи");
  }
  if (offerUsesOpeningHours(productType) && form.hoursSource === "own") {
    const hasOpenDay = form.hours.mode !== "WEEKLY" || form.hours.rules.some((rule) => rule.isOpen);
    if (!hasOpenDay) missing.push("Дни работы");
  }
  return missing;
}
