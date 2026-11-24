import { BookingStatus } from "@prisma/client";
import { z } from "zod";

/** Business declines need an operational explanation; never accept blank reasons. */
export const businessBookingDecisionSchema = z.object({
  status: z.enum([BookingStatus.CONFIRMED, BookingStatus.REJECTED, BookingStatus.COMPLETED]),
  reason: z.string().trim().min(5, "Укажите причину отказа (не менее 5 символов)")
    .max(500, "Причина отказа слишком длинная").optional(),
}).superRefine((value, ctx) => {
  if (value.status === BookingStatus.REJECTED && !value.reason) {
    ctx.addIssue({ code: "custom", path: ["reason"], message: "Укажите причину отказа" });
  }
});
