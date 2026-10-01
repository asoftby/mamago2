import { z } from "zod";
import { RecommendationSurface } from "@prisma/client";
import { AGE_GROUPS } from "@/features/filters/age/ageGroups";
import { SYSTEM_INTERESTS } from "@/lib/config/interests";

/**
 * decisionContext.v1 — shared shape for "what is being decided, for whom,
 * right now" across recommendations, save/plan actions and (later) birthday.
 *
 * Privacy: only IDs, roles, ranges and booleans belong here. Never a name,
 * birth date, email, phone or free-text profile field — see mamaGo Family
 * Core program, section 0.3.
 */
export const DECISION_CONTEXT_VERSION = 1 as const;

export const SUBJECT_SOURCE = ["profile", "manual", "derived"] as const;
export type SubjectSource = (typeof SUBJECT_SOURCE)[number];

/**
 * The ONLY age-range values decision context may ever persist. Sourced from
 * the single canonical bucket table — never a second, divergent vocabulary.
 * Any client-supplied string outside this set must be dropped before it
 * reaches a Subject or a constraint, never stored as free text.
 */
export const CANONICAL_AGE_RANGE_VALUES = AGE_GROUPS.map((g) => g.value) as [
  string,
  ...string[],
];
export const MAX_AGE_RANGES = AGE_GROUPS.length;

/** One canonical age-range value — the request-side twin of Subject.ageRange. */
export const CanonicalAgeRangeSchema = z.enum(CANONICAL_AGE_RANGE_VALUES);

/**
 * Request-body contract for a list of age ranges: canonical values only and
 * bounded. Malformed or oversized input is REJECTED (not silently trimmed),
 * so no free-text or oversized value ever reaches ranking, persistence or a
 * decision context.
 */
export const AgeRangesRequestSchema = z.array(CanonicalAgeRangeSchema).max(MAX_AGE_RANGES);

const AGE_RANGES_QUERY_MAX_CHARS = 128;

/**
 * Strict parser for a comma-separated `ageRanges` query value. Absent/empty
 * -> ok with []. Anything oversized, non-canonical or over-long -> not ok.
 */
export function parseCanonicalAgeRangesQuery(
  raw: string | null | undefined,
): { ok: true; values: string[] } | { ok: false } {
  if (raw == null || raw === "") return { ok: true, values: [] };
  if (raw.length > AGE_RANGES_QUERY_MAX_CHARS) return { ok: false };
  const parts = raw.split(",").filter(Boolean);
  const parsed = AgeRangesRequestSchema.safeParse(parts);
  if (!parsed.success) return { ok: false };
  return { ok: true, values: [...new Set(parsed.data)] };
}

export const SubjectSchema = z.object({
  kind: z.enum(["adult", "child"]),
  /** Child.id for an authorized child, User.id for the current adult, null for guest/manual participants. */
  refId: z.string().nullable(),
  /** Adult only. */
  role: z.string().optional(),
  /** Child only — one of CANONICAL_AGE_RANGE_VALUES, e.g. "3-5". Never free text. */
  ageRange: CanonicalAgeRangeSchema.optional(),
  source: z.enum(SUBJECT_SOURCE),
});
export type Subject = z.infer<typeof SubjectSchema>;

export const DECISION_INTENTS = [
  "my_plan_suggestions",
  "guest_plan_generate",
] as const;
export type DecisionIntent = (typeof DECISION_INTENTS)[number];

const ConstraintValueSchema = z.object({
  value: z.unknown(),
  source: z.enum(SUBJECT_SOURCE),
});

const CANONICAL_SYSTEM_INTEREST_VALUES = SYSTEM_INTERESTS.map((interest) => interest.slug) as [
  string,
  ...string[],
];
export const ProfileInterestsConstraintSchema = z.object({
  value: z.array(z.enum(CANONICAL_SYSTEM_INTEREST_VALUES)).max(SYSTEM_INTERESTS.length),
  source: z.literal("profile"),
});
const DecisionConstraintsSchema = z
  .record(z.string(), ConstraintValueSchema)
  .superRefine((constraints, ctx) => {
    if (!("interests" in constraints)) return;
    const parsed = ProfileInterestsConstraintSchema.safeParse(constraints.interests);
    if (!parsed.success) {
      ctx.addIssue({
        code: "custom",
        path: ["interests"],
        message: "interests must contain bounded canonical profile values",
      });
    }
  });

export const DecisionContextV1Schema = z.object({
  contextVersion: z.literal(DECISION_CONTEXT_VERSION),
  /** Set once the RecommendationRun exists; null while still being built. */
  decisionId: z.string().nullable(),
  intent: z.enum(DECISION_INTENTS),
  surface: z.nativeEnum(RecommendationSurface).nullable(),
  cityId: z.string().nullable(),
  citySlug: z.string().nullable(),
  targetDate: z.string().nullable(),
  dateRange: z
    .object({ from: z.string(), to: z.string() })
    .nullable()
    .optional(),
  subjects: z.array(SubjectSchema),
  constraints: DecisionConstraintsSchema.optional(),
  /** Reserved for FAM-004 (Family/Person/Membership). Always null until then. */
  familyId: z.string().nullable(),
  actor: z.object({
    kind: z.enum(["user", "guest"]),
    id: z.string().nullable(),
  }),
  source: z.enum(["client", "server"]),
});
export type DecisionContextV1 = z.infer<typeof DecisionContextV1Schema>;

/**
 * Drops any non-canonical / free-text value and caps the array length.
 * The single sanitation point for every client-supplied age-range list
 * before it can reach a persisted decision context (constraints, or a
 * Subject via buildManualSubjectsSnapshot).
 */
export function sanitizeCanonicalAgeRanges(values: readonly string[]): string[] {
  const canonical = new Set<string>(CANONICAL_AGE_RANGE_VALUES);
  const deduped = [...new Set(values)].filter((v) => canonical.has(v));
  return deduped.slice(0, MAX_AGE_RANGES);
}

export type BuildDecisionContextV1Input = {
  /** RecommendationRun.id — known only after the run row is created. */
  decisionId: string | null;
  intent: DecisionIntent;
  surface: RecommendationSurface | null;
  cityId: string | null;
  citySlug: string | null;
  targetDate: string | null;
  dateRange?: { from: string; to: string } | null;
  subjects: Subject[];
  constraints?: Record<string, { value: unknown; source: SubjectSource }>;
  actor: { kind: "user" | "guest"; id: string | null };
  source: "client" | "server";
};

/**
 * The single canonical builder for a persisted decisionContext.v1 payload.
 * Always validates via DecisionContextV1Schema.parse before returning —
 * callers must never assemble this shape ad hoc, and must never persist a
 * decisionContext object that hasn't gone through here.
 */
export function buildDecisionContextV1(input: BuildDecisionContextV1Input): DecisionContextV1 {
  return DecisionContextV1Schema.parse({
    contextVersion: DECISION_CONTEXT_VERSION,
    decisionId: input.decisionId,
    intent: input.intent,
    surface: input.surface,
    cityId: input.cityId,
    citySlug: input.citySlug,
    targetDate: input.targetDate,
    dateRange: input.dateRange ?? null,
    subjects: input.subjects,
    constraints: input.constraints,
    familyId: null,
    actor: input.actor,
    source: input.source,
  });
}
