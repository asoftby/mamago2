import assert from "node:assert/strict";
import {
  DECISION_CONTEXT_VERSION,
  DecisionContextV1Schema,
  SubjectSchema,
} from "./decisionContext";

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

console.log("decisionContext.test.ts OK");
