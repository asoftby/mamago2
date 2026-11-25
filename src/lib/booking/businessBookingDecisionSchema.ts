import { BookingStatus } from "@prisma/client";
import { z } from "zod";

export const businessRejectionReasons = [
  "Нет свободных мест", "Мероприятие отменено", "Изменилось расписание",
  "Участник не соответствует условиям посещения", "Другая причина",
] as const;

export const businessBookingDecisionSchema = z.object({
  status: z.enum([BookingStatus.CONFIRMED, BookingStatus.REJECTED, BookingStatus.CANCELLED, BookingStatus.COMPLETED]),
  reason: z.enum(businessRejectionReasons).optional(),
  comment: z.string().trim().max(500).optional(),
}).superRefine((value, ctx) => {
  if (value.status !== BookingStatus.REJECTED && value.status !== BookingStatus.CANCELLED) return;
  if (!value.reason) ctx.addIssue({ code: "custom", path: ["reason"], message: "Укажите причину отказа" });
  if (value.reason === "Другая причина" && !value.comment) {
    ctx.addIssue({ code: "custom", path: ["comment"], message: "Укажите пояснение" });
  }
}).transform((value) => ({
  ...value,
  reason: value.reason ? [value.reason, value.comment].filter(Boolean).join(": ") : undefined,
}));
