import { z } from "zod";
import { AgeRangesRequestSchema } from "@/lib/decision/decisionContext";
import { SafeOpaqueIdSchema } from "@/lib/decision/identifiers";

const calendarDaySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((day) => {
  const parsed = new Date(day + "T12:00:00Z");
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(day);
}, "Некорректная дата");

/**
 * Request contract for POST /api/plan/generate. Kept out of the route file
 * (Next.js route modules may only export handlers) so it is directly testable.
 * Age ranges are canonical + bounded and the guest identity is a bounded
 * opaque id — malformed input is rejected, never trimmed or persisted.
 */
export const guestGenerateBodySchema = z.object({
  anonymousId: SafeOpaqueIdSchema.optional().nullable(),
  city: z.string().min(1).optional().default("minsk"),
  date: calendarDaySchema.optional(),
  /** Saturday–Sunday for the guest weekend picker; maximum two days. */
  dateTo: calendarDaySchema.optional(),
  exclude: z.array(z.string()).optional(),
  ageRanges: AgeRangesRequestSchema.optional(),
  /** Интересы из квиза гостя; на сервере отфильтровываются по каноническому списку. */
  interests: z.array(z.string().max(40)).max(13).optional(),
}).refine(({ date, dateTo }) => {
  if (!dateTo) return true;
  if (!date || dateTo < date) return false;
  return (Date.parse(dateTo + "T12:00:00Z") - Date.parse(date + "T12:00:00Z")) <= 86_400_000;
}, { message: "Дата окончания должна быть в пределах двух дней", path: ["dateTo"] });
