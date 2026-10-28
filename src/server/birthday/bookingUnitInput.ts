import { z } from "zod";

/** Multiple non-overlapping working intervals per ISO weekday. */
export const bookingUnitFieldsSchema = z.object({
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
}).strict();

export const bookingUnitCreateSchema = bookingUnitFieldsSchema.superRefine((v, ctx) => {
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


/** Full-replacement edit with optimistic concurrency and dated exceptions. */
export const bookingUnitUpdateSchema = bookingUnitFieldsSchema.extend({
  expectedUpdatedAt: z.string().datetime(),
  status: z.enum(["ACTIVE", "INACTIVE"]),
  exceptions: z.array(z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    kind: z.enum(["CLOSED", "OPEN_OVERRIDE"]),
    startMinutes: z.number().int().min(0).max(1439).nullable(),
    endMinutes: z.number().int().min(1).max(1440).nullable(),
  }).strict()).max(366),
}).superRefine((v, ctx) => {
  const { expectedUpdatedAt: _version, status: _status, exceptions: _exceptions, ...core } = v;
  const schedule = bookingUnitCreateSchema.safeParse(core);
  if (!schedule.success) {
    for (const issue of schedule.error.issues)
      ctx.addIssue({ code: "custom", path: issue.path, message: issue.message });
  }
  for (const [i, entry] of v.exceptions.entries()) {
    const date = new Date(entry.date + "T00:00:00.000Z");
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== entry.date)
      ctx.addIssue({ code: "custom", path: ["exceptions", i, "date"], message: "Invalid calendar date" });
    if ((entry.startMinutes === null) !== (entry.endMinutes === null) ||
      (entry.startMinutes !== null && entry.endMinutes !== null &&
        entry.startMinutes >= entry.endMinutes))
      ctx.addIssue({ code: "custom", path: ["exceptions", i], message: "Invalid exception interval" });
  }
  for (let i = 0; i < v.exceptions.length; i++)
    for (let j = i + 1; j < v.exceptions.length; j++) {
      const a = v.exceptions[i], b = v.exceptions[j];
      if (a.date === b.date &&
        (a.startMinutes ?? 0) < (b.endMinutes ?? 1440) &&
        (b.startMinutes ?? 0) < (a.endMinutes ?? 1440))
        ctx.addIssue({ code: "custom", path: ["exceptions", j], message: "Overlapping exceptions" });
    }
});
