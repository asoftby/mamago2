import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Дата в формате ГГГГ-ММ-ДД")
  .refine((date) => {
    const result = new Date(date + "T00:00:00Z");
    return !Number.isNaN(result.valueOf()) && result.toISOString().startsWith(date);
  }, "Некорректная дата");
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Время в формате ЧЧ:ММ");

export const createPartyDraftSchema = z.object({
  citySlug: z.string().regex(/^[a-z][a-z0-9-]{0,80}$/),
  venueMode: z.enum(["VENUE", "PACKAGE", "HOME", "OUTDOOR"]),
}).strict();

export const updatePartyDraftSchema = z.object({
  version: z.number().int().nonnegative(),
  venueMode: z.enum(["VENUE", "PACKAGE", "HOME", "OUTDOOR"]).optional(),
  eventDate: isoDate.nullable().optional(),
  timeFrom: time.nullable().optional(),
  timeTo: time.nullable().optional(),
  childrenCount: z.number().int().min(0).max(500).nullable().optional(),
  adultsCount: z.number().int().min(0).max(500).nullable().optional(),
  childAge: z.number().int().min(0).max(20).nullable().optional(),
  childName: z.string().max(120).nullable().optional(),
  budgetByn: z.number().nonnegative().max(1_000_000).nullable().optional(),
  contactName: z.string().max(120).nullable().optional(),
  contactPhone: z.string().max(40).nullable().optional(),
  anchorOfferId: z.string().min(1).nullable().optional(),
  addonOfferIds: z.array(z.string().min(1)).max(15).optional(),
}).strict().refine(
  (value) => (value.anchorOfferId === undefined) === (value.addonOfferIds === undefined),
  "Передайте основную и дополнительные услуги вместе",
);

export type UpdatePartyDraft = z.infer<typeof updatePartyDraftSchema>;

export class PartyApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

export function partyStartAt(date: Date, timeFrom: string): Date {
  // Belarus has UTC+03:00; calendar resources later apply their own timezones.
  const dateKey = date.toISOString().slice(0, 10);
  return new Date(dateKey + "T" + timeFrom + ":00+03:00");
}

export function validateSubmissionWindow(eventStart: Date, now: Date): Date {
  if (!Number.isFinite(eventStart.valueOf()) || eventStart.getTime() <= now.getTime() + 24 * 60 * 60_000) {
    throw new PartyApiError(422, "До праздника должно оставаться больше 24 часов");
  }
  const hoursUntil = (eventStart.getTime() - now.getTime()) / 3_600_000;
  const due = hoursUntil < 72
    ? new Date(now.getTime() + 4 * 3_600_000)
    : new Date(Math.min(now.getTime() + 24 * 3_600_000, eventStart.getTime() - 48 * 3_600_000));
  if (due <= now) throw new PartyApiError(422, "Срок ответа уже прошёл");
  return due;
}

export function localMinskDate(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Minsk", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const item = (kind: string) => parts.find((part) => part.type === kind)?.value ?? "";
  return item("year") + "-" + item("month") + "-" + item("day");
}
