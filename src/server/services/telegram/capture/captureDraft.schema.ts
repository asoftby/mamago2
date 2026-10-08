import { z } from "zod";

/**
 * CaptureDraft: the only shape the model may return (forward-to-plan spec
 * v1.3, section 7.4). Strict on purpose: no `reasoning`, `confidence`,
 * `userId`, `familyId` or any other free-form/diagnostic field is accepted.
 */
const FieldState = z.enum(["stated", "inferred", "missing"]);
const RequirementState = z.enum(["stated", "inferred"]);

/** ISO 8601 with an explicit offset or Z; nothing else is accepted. */
const IsoDateTime = z.string().datetime({ offset: true });
const NullableIso = IsoDateTime.nullable();

const TitleField = z.strictObject({ value: z.string(), state: FieldState });

const ChildField = z.strictObject({
  childId: z.string().nullable(),
  raw: z.string().nullable(),
  state: FieldState,
});

const StartsAtField = z.strictObject({
  value: NullableIso,
  state: FieldState,
  basis: z.string().nullable(),
});

const TimeField = z.strictObject({ value: NullableIso, state: FieldState });

const DueAtField = z.strictObject({
  value: NullableIso,
  hasTime: z.boolean(),
  state: FieldState,
});

const LocationField = z.strictObject({
  value: z.string().nullable(),
  placeId: z.string().nullable(),
  state: FieldState,
});

const RequirementField = z.strictObject({
  kind: z.enum(["BRING", "PAY", "DOCUMENT"]),
  text: z.string(),
  dueAt: NullableIso,
  dueHasTime: z.boolean(),
  amount: z.number().nullable(),
  currency: z.string().nullable(),
  state: RequirementState,
});

const EntrySchema = z.strictObject({
  entryType: z.enum(["EVENT", "ACTIVITY", "TASK"]),
  title: TitleField,
  child: ChildField,
  startsAt: StartsAtField,
  arriveAt: TimeField,
  endsAt: TimeField,
  dueAt: DueAtField,
  location: LocationField,
  requirements: z.array(RequirementField),
  notes: z.string().nullable(),
});

const MatchSchema = z.strictObject({
  candidatePlanItemId: z.string().nullable(),
  changes: z.array(
    z.strictObject({
      field: z.string(),
      from: NullableIso,
      to: NullableIso,
    }),
  ),
});

export const CaptureDraftSchema = z
  .strictObject({
    intent: z.enum(["CREATE", "UPDATE", "CANCEL", "NONE"]),
    entries: z.array(EntrySchema),
    match: MatchSchema,
  })
  .superRefine((draft, ctx) => {
    // NONE means "nothing actionable": a draft that also carries entries is
    // contradictory, so it is invalid output (retry / escalation), not data.
    if (draft.intent === "NONE" && draft.entries.length > 0) {
      ctx.addIssue({ code: "custom", path: ["entries"], message: "NONE requires empty entries" });
    }
  });

export type CaptureDraft = z.infer<typeof CaptureDraftSchema>;
export type CaptureEntry = CaptureDraft["entries"][number];
export type FieldStateValue = z.infer<typeof FieldState>;

export type ParseDraftResult =
  | { ok: true; draft: CaptureDraft }
  | { ok: false; code: "INVALID_JSON" | "INVALID_SCHEMA" };

/** Accepts a bare JSON object or one wrapped in a markdown code fence. */
export function parseCaptureDraft(raw: string): ParseDraftResult {
  const trimmed = raw.trim();
  const unfenced = trimmed.startsWith("```")
    ? trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
    : trimmed;

  let json: unknown;
  try {
    json = JSON.parse(unfenced);
  } catch {
    return { ok: false, code: "INVALID_JSON" };
  }
  const parsed = CaptureDraftSchema.safeParse(json);
  return parsed.success ? { ok: true, draft: parsed.data } : { ok: false, code: "INVALID_SCHEMA" };
}

/** JSON Schema for providers/models with structured-output support (opt-in). */
export function captureDraftJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(CaptureDraftSchema, { target: "draft-7" }) as Record<string, unknown>;
}
