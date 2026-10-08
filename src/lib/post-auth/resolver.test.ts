import assert from "node:assert/strict";
import test from "node:test";
import type { AuthEntryPoint, ProfileStatePayload } from "./types";
import { resolvePostAuthFlow } from "./resolver";

function profile(
  overrides: Partial<ProfileStatePayload> = {},
): ProfileStatePayload {
  return {
    isProfileComplete: false,
    resumeStep: "adult",
    primaryChildId: null,
    hasAdultProfile: false,
    hasChildProfile: false,
    hasChildInterests: false,
    user: {
      id: "user-1",
      familyRole: null,
      ageBandLabel: null,
    },
    children: [],
    ...overrides,
  };
}

const sources: AuthEntryPoint[] = [
  "profile",
  "save_idea",
  "save_plan",
  "my_plan",
  "birthday_constructor",
];

test("every post-auth entry point uses completion for an incomplete profile", () => {
  for (const source of sources) {
    assert.deepEqual(
      resolvePostAuthFlow({
        source,
        returnTo: "/return-here?from=auth",
        profile: profile({ resumeStep: "child" }),
      }),
      {
        kind: "completion",
        source,
        returnTo: "/return-here?from=auth",
        resumeStep: "child",
      },
    );
  }
});

test("missing resume step fails safe to the adult start", () => {
  assert.equal(
    resolvePostAuthFlow({
      source: "profile",
      returnTo: null,
      profile: profile({ resumeStep: null }),
    }).kind,
    "completion",
  );
  assert.deepEqual(
    resolvePostAuthFlow({
      source: "profile",
      returnTo: null,
      profile: profile({ resumeStep: null }),
    }),
    {
      kind: "completion",
      source: "profile",
      returnTo: null,
      resumeStep: "adult",
    },
  );
});

test("complete profiles preserve source and return target without onboarding", () => {
  for (const source of sources) {
    assert.deepEqual(
      resolvePostAuthFlow({
        source,
        returnTo: "/safe-target",
        profile: profile({ isProfileComplete: true, resumeStep: null }),
      }),
      { kind: "done", source, returnTo: "/safe-target" },
    );
  }
});
