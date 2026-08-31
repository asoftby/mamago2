import { z } from "zod";

export const OPENING_HOURS_MODES = [
  "WEEKLY",
  "ALWAYS_OPEN",
  "BY_APPOINTMENT",
  "TEMPORARILY_CLOSED",
] as const;
export const OPENING_HOURS_DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const interval = z.object({ startTime: time, endTime: time });

const scheduleEntry = z
  .object({
    isOpen: z.boolean(),
    allDay: z.boolean(),
    intervals: z.array(interval),
  })
  .superRefine((value, ctx) => {
    if ((!value.isOpen || value.allDay) && value.intervals.length > 0) {
      ctx.addIssue({ code: "custom", message: "Closed/all-day entries cannot contain intervals" });
    }
    if (value.isOpen && !value.allDay && value.intervals.length === 0) {
      ctx.addIssue({ code: "custom", message: "Open entries require an interval" });
    }
    for (const item of value.intervals) {
      if (item.startTime >= item.endTime) {
        ctx.addIssue({ code: "custom", message: "Opening intervals must end after they start" });
      }
    }
  });

export const SharedOpeningHoursDataSchema = z.object({
  mode: z.enum(OPENING_HOURS_MODES),
  timezone: z.string().trim().min(1),
  note: z.string().trim().optional(),
  rules: z.array(scheduleEntry.extend({ dayOfWeek: z.enum(OPENING_HOURS_DAYS) })),
  exceptions: z.array(
    z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      isClosed: z.boolean(),
      allDay: z.boolean(),
      intervals: z.array(interval),
      note: z.string().trim().optional(),
    }).superRefine((value, ctx) => {
      if ((value.isClosed || value.allDay) && value.intervals.length > 0) {
        ctx.addIssue({ code: "custom", message: "Closed/all-day exceptions cannot contain intervals" });
      }
      if (!value.isClosed && !value.allDay && value.intervals.length === 0) {
        ctx.addIssue({ code: "custom", message: "Open exceptions require an interval" });
      }
      for (const item of value.intervals) {
        if (item.startTime >= item.endTime) {
          ctx.addIssue({ code: "custom", message: "Exception intervals must end after they start" });
        }
      }
    }),
  ),
}).superRefine((value, ctx) => {
  if (new Set(value.rules.map((rule) => rule.dayOfWeek)).size !== value.rules.length) {
    ctx.addIssue({ code: "custom", path: ["rules"], message: "Weekdays must be unique" });
  }
  if (new Set(value.exceptions.map((exception) => exception.date)).size !== value.exceptions.length) {
    ctx.addIssue({ code: "custom", path: ["exceptions"], message: "Exception dates must be unique" });
  }
});

export type SharedOpeningHoursData = z.infer<typeof SharedOpeningHoursDataSchema>;

type RelationalOpeningHoursSource = {
  mode: (typeof OPENING_HOURS_MODES)[number];
  timezone: string;
  note?: string | null;
  rules: Array<{
    dayOfWeek: (typeof OPENING_HOURS_DAYS)[number];
    isOpen: boolean;
    allDay: boolean;
    intervals: Array<{ startTime: string; endTime: string; sortOrder?: number }>;
  }>;
  exceptions: Array<{
    date: string;
    isClosed: boolean;
    allDay: boolean;
    note?: string | null;
    intervals: Array<{ startTime: string; endTime: string; sortOrder?: number }>;
  }>;
};

const dayPosition = new Map(OPENING_HOURS_DAYS.map((day, index) => [day, index]));
const clean = (value: string | null | undefined) => value?.trim() || undefined;
const sortedIntervals = (items: Array<{ startTime: string; endTime: string; sortOrder?: number }>) =>
  [...items]
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map(({ startTime, endTime }) => ({ startTime, endTime }));

export function openingHoursFromRelational(source: RelationalOpeningHoursSource): SharedOpeningHoursData {
  const note = clean(source.note);
  return SharedOpeningHoursDataSchema.parse({
    mode: source.mode,
    timezone: source.timezone.trim(),
    ...(note ? { note } : {}),
    rules: [...source.rules]
      .sort((a, b) => (dayPosition.get(a.dayOfWeek) ?? 7) - (dayPosition.get(b.dayOfWeek) ?? 7))
      .map((rule) => ({
        dayOfWeek: rule.dayOfWeek,
        isOpen: rule.isOpen,
        allDay: rule.allDay,
        intervals: rule.isOpen && !rule.allDay ? sortedIntervals(rule.intervals) : [],
      })),
    exceptions: [...source.exceptions]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((exception) => {
        const exceptionNote = clean(exception.note);
        return {
          date: exception.date,
          isClosed: exception.isClosed,
          allDay: exception.allDay,
          ...(exceptionNote ? { note: exceptionNote } : {}),
          intervals: !exception.isClosed && !exception.allDay ? sortedIntervals(exception.intervals) : [],
        };
      }),
  });
}
