import { z } from "zod";

/** Multiple non-overlapping working intervals per ISO weekday. */
export const bookingUnitCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  capacity: z.number().int().positive().max(1000).nullable().default(null),
  prepMinutes: z.number().int().min(0).max(240).default(0),
  cleanupMinutes: z.number().int().min(0).max(240).default(0),
  minDurationMinutes: z.number().int().min(15).max(1440).nullable().default(null),
  stepMinutes: z.number().int().min(5).max(240).default(30),
  offerIds: z.array(z.string().min(1)).min(1).max(30),
  rules: z.array(z.object({
    weekday: z.number().int().min(1).max(7),
    startMinutes: z.number().int().min(0).max(1439),
    endMinutes: z.number().int().min(1).max(1440),
  })).min(1).max(35),
}).strict().superRefine((v, ctx) => {
  if (new Set(v.offerIds).size !== v.offerIds.length)
    ctx.addIssue({ code: "custom", path: ["offerIds"], message: "Duplicate offer" });
  for (const [i, rule] of v.rules.entries()) {
    if (rule.startMinutes >= rule.endMinutes)
      ctx.addIssue({ code: "custom", path: ["rules", i], message: "Invalid interval" });
    if (v.minDurationMinutes !== null && rule.endMinutes - rule.startMinutes < v.minDurationMinutes)
      ctx.addIssue({ code: "custom", path: ["rules", i], message: "Shorter than minimum duration" });
  }
  for (let i = 0; i < v.rules.length; i++)
    for (let j = i + 1; j < v.rules.length; j++) {
      const a = v.rules[i], b = v.rules[j];
      if (a.weekday === b.weekday && a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes)
        ctx.addIssue({ code: "custom", path: ["rules", j], message: "Overlapping intervals" });
    }
});
