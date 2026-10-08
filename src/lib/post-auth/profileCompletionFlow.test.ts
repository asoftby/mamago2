import assert from "node:assert/strict";
import test from "node:test";
import type { ProfileStatePayload } from "./types";
import {
  nextStepAfterAdultSave,
  nextStepAfterChildSave,
  nextStepAfterInterests,
  resolveInitialProfileFlowAction,
} from "./profileCompletionFlow";

function state(
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

test("new profile continues from optional adult screen to child", () => {
  const initial = resolveInitialProfileFlowAction(state());
  assert.deepEqual(initial, { kind: "show", step: "adult" });
  assert.equal(nextStepAfterAdultSave(), "child");
});

test("selected adult role still continues to child", () => {
  const initial = resolveInitialProfileFlowAction(
    state({
      user: { id: "user-1", familyRole: "mother", ageBandLabel: null },
    }),
  );
  assert.deepEqual(initial, { kind: "show", step: "adult" });
  assert.equal(nextStepAfterAdultSave(), "child");
});

test("child save reaches optional interests even when refreshed state is complete", () => {
  const refreshed = state({ isProfileComplete: true, resumeStep: null });
  assert.deepEqual(resolveInitialProfileFlowAction(refreshed), {
    kind: "finish",
    alreadyComplete: true,
  });
  assert.equal(nextStepAfterChildSave(), "child_interests");
});

test("skipping optional interests continues to add-more-children", () => {
  assert.equal(nextStepAfterInterests(), "add_more_children");
});

test("saving interests continues to add-more-children", () => {
  assert.equal(nextStepAfterInterests(), "add_more_children");
});

test("already-complete profile opened fresh auto-finishes", () => {
  assert.deepEqual(
    resolveInitialProfileFlowAction(
      state({ isProfileComplete: true, resumeStep: null }),
    ),
    { kind: "finish", alreadyComplete: true },
  );
});
