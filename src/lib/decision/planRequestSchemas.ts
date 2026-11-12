import { z } from "zod";

export const calendarDaySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((day) => {
  const parsed = new Date(day + "T12:00:00Z");
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(day);
}, "Некорректная дата");
