import { z } from "zod";
import { RecommendationSurface } from "@prisma/client";

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

export const SubjectSchema = z.object({
  kind: z.enum(["adult", "child"]),
  /** Child.id for an authorized child, User.id for the current adult, null for guest/manual participants. */
  refId: z.string().nullable(),
  /** Adult only. */
  role: z.string().optional(),
  /** Child only, e.g. "3-5". */
  ageRange: z.string().optional(),
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
  constraints: z.record(z.string(), ConstraintValueSchema).optional(),
  /** Reserved for FAM-004 (Family/Person/Membership). Always null until then. */
  familyId: z.string().nullable(),
  actor: z.object({
    kind: z.enum(["user", "guest"]),
    id: z.string().nullable(),
  }),
  source: z.enum(["client", "server"]),
});
export type DecisionContextV1 = z.infer<typeof DecisionContextV1Schema>;
