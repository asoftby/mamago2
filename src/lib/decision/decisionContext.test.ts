import assert from "node:assert/strict";
import {
  DECISION_CONTEXT_VERSION,
  DecisionContextV1Schema,
  SubjectSchema,
  CANONICAL_AGE_RANGE_VALUES,
  MAX_AGE_RANGES,
  sanitizeCanonicalAgeRanges,
  buildDecisionContextV1,
} from "./decisionContext";
import { isPersonalizedResult } from "./personalization";
import { parseCanonicalAgeRangesQuery } from "./decisionContext";
import { guestGenerateBodySchema } from "./planRequestSchemas";
import { parseSafeOpaqueId, readOptionalSafeOpaqueId } from "./identifiers";

// Round-trip a realistic my_plan_suggestions context.
const sample = {
  contextVersion: DECISION_CONTEXT_VERSION,
  decisionId: "run_123",
  intent: "my_plan_suggestions" as const,
  surface: "MY_PLAN" as const,
  cityId: "city_1",
  citySlug: "minsk",
  targetDate: "2026-09-30",
  subjects: [
    { kind: "adult" as const, refId: "user_1", role: "mom", source: "profile" as const },
    { kind: "child" as const, refId: "child_1", ageRange: "3-5", source: "profile" as const },
  ],
  constraints: {
    ageRanges: { value: ["3-5"], source: "profile" as const },
  },
  familyId: null,
  actor: { kind: "user" as const, id: "user_1" },
  source: "server" as const,
};

const parsed = DecisionContextV1Schema.parse(sample);
assert.deepEqual(parsed, sample);

// A guest run has no decisionId yet, no authorized subjects, familyId reserved null.
const guestSample = {
  contextVersion: 1 as const,
  decisionId: null,
  intent: "guest_plan_generate" as const,
  surface: "MY_PLAN" as const,
  cityId: null,
  citySlug: "minsk",
  targetDate: null,
  subjects: [{ kind: "child" as const, refId: null, ageRange: "1-3", source: "manual" as const }],
  familyId: null,
  actor: { kind: "guest" as const, id: null },
  source: "server" as const,
};
assert.doesNotThrow(() => DecisionContextV1Schema.parse(guestSample));

// Reject wrong contextVersion (contract must stay v1-pinned, not silently accept future versions).
assert.throws(() => DecisionContextV1Schema.parse({ ...guestSample, contextVersion: 2 }));

// Privacy: the contract must never declare a name/DOB/email/phone field.
const subjectKeys = Object.keys(SubjectSchema.shape);
for (const forbidden of ["name", "displayName", "birthDate", "dob", "email", "phone"]) {
  assert.equal(subjectKeys.includes(forbidden), false, `Subject must never declare "${forbidden}"`);
}

// ---- P2 finding 3: ageRange is canonical-only, never free text ----

// Every canonical value round-trips through SubjectSchema.
for (const value of CANONICAL_AGE_RANGE_VALUES) {
  assert.doesNotThrow(() =>
    SubjectSchema.parse({ kind: "child", refId: null, ageRange: value, source: "manual" }),
  );
}
// An arbitrary/free-text ageRange must be rejected at the schema level —
// this is the defense-in-depth backstop, not just a call-site filter.
assert.throws(
  () => SubjectSchema.parse({ kind: "child", refId: null, ageRange: "not-a-range", source: "manual" }),
  "a non-canonical ageRange must never validate as a Subject",
);
assert.throws(
  () => SubjectSchema.parse({ kind: "child", refId: null, ageRange: "<script>", source: "manual" }),
  "no arbitrary string, however adversarial, can enter a Subject's ageRange",
);

// sanitizeCanonicalAgeRanges: drops unknown values, dedupes, caps length.
assert.deepEqual(
  sanitizeCanonicalAgeRanges(["3-5", "not-a-range", "3-5", "1-3"]),
  ["3-5", "1-3"],
  "unknown values dropped, duplicates removed, canonical order preserved by first-seen",
);
assert.deepEqual(sanitizeCanonicalAgeRanges(["free text", "??", ""]), []);
const oversized = sanitizeCanonicalAgeRanges([...CANONICAL_AGE_RANGE_VALUES, ...CANONICAL_AGE_RANGE_VALUES]);
assert.ok(oversized.length <= MAX_AGE_RANGES, "sanitized list is capped at MAX_AGE_RANGES");

// ---- P1 finding 1: buildDecisionContextV1 is the only construction path, and it validates ----

const built = buildDecisionContextV1({
  decisionId: "run_abc",
  intent: "my_plan_suggestions",
  surface: "MY_PLAN",
  cityId: "city_1",
  citySlug: "minsk",
  targetDate: "2026-09-30",
  subjects: [{ kind: "child", refId: "child_1", ageRange: "3-5", source: "profile" }],
  constraints: { ageRanges: { value: ["3-5"], source: "manual" } },
  actor: { kind: "user", id: "user_1" },
  source: "server",
});
assert.equal(built.decisionId, "run_abc", "decisionId flows through as given (= RecommendationRun.id by caller contract)");
assert.equal(built.familyId, null, "familyId always reserved null (pre-FAM-004)");
assert.doesNotThrow(() => DecisionContextV1Schema.parse(built), "builder output always re-validates");

// A caller passing a bad intent/subject must fail loudly, not persist silently.
assert.throws(() =>
  buildDecisionContextV1({
    decisionId: null,
    // @ts-expect-error -- intentionally invalid to prove the builder rejects it
    intent: "not_a_real_intent",
    surface: null,
    cityId: null,
    citySlug: null,
    targetDate: null,
    subjects: [],
    actor: { kind: "guest", id: null },
    source: "server",
  }),
);

// ---- P2 finding 5: FIRST_PERSONALIZED_RESULT gating ----

assert.equal(isPersonalizedResult([], []), false, "generic result (no subjects, no age filter) is not personalized");
assert.equal(
  isPersonalizedResult([{ kind: "child", refId: "c1", ageRange: "3-5", source: "profile" }], []),
  true,
  "a resolved profile subject counts as personalization",
);
assert.equal(isPersonalizedResult([], ["3-5"]), true, "a canonical explicit age-range filter counts as personalization");

// ---- follow-up: request input is canonical + bounded, malformed is REJECTED ----

const GUEST_ID = "5b1f0c2e-7a4d-4c1e-9a55-0f7d3e2b6a10";
assert.equal(
  guestGenerateBodySchema.safeParse({ anonymousId: GUEST_ID, ageRanges: ["3-5", "1-3"] }).success,
  true,
  "canonical ranges + safe anonymousId accepted",
);
assert.equal(
  guestGenerateBodySchema.safeParse({ ageRanges: ["3-5", "free text"] }).success,
  false,
  "a free-text range rejects the whole request instead of being trimmed",
);
assert.equal(
  guestGenerateBodySchema.safeParse({ ageRanges: Array(MAX_AGE_RANGES + 1).fill("3-5") }).success,
  false,
  "an oversized array is rejected, not silently capped",
);
assert.equal(guestGenerateBodySchema.safeParse({ anonymousId: "x".repeat(500) }).success, false, "huge anonymousId rejected");
assert.equal(guestGenerateBodySchema.safeParse({ anonymousId: "drop table; --" }).success, false, "free-text anonymousId rejected");

assert.deepEqual(parseCanonicalAgeRangesQuery(null), { ok: true, values: [] });
assert.deepEqual(parseCanonicalAgeRangesQuery("3-5,1-3,3-5"), { ok: true, values: ["3-5", "1-3"] });
assert.deepEqual(parseCanonicalAgeRangesQuery("3-5,nope"), { ok: false });
assert.deepEqual(parseCanonicalAgeRangesQuery(Array(200).fill("3-5").join(",")), { ok: false }, "endless query list rejected");

assert.equal(parseSafeOpaqueId(GUEST_ID), GUEST_ID);
assert.equal(parseSafeOpaqueId("ckexposure00000000000000001"), "ckexposure00000000000000001");
assert.equal(parseSafeOpaqueId("short"), null);
assert.equal(parseSafeOpaqueId("has spaces in it here"), null);
assert.equal(parseSafeOpaqueId("y".repeat(65)), null);
assert.deepEqual(readOptionalSafeOpaqueId(undefined), { ok: true, value: null });
assert.deepEqual(readOptionalSafeOpaqueId("  "), { ok: true, value: null });
assert.deepEqual(readOptionalSafeOpaqueId("bad id!"), { ok: false });

console.log("decisionContext.test.ts OK");
