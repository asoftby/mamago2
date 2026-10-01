import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path: string): string {
  return readFileSync(new URL(`../../../src/${path}`, import.meta.url), "utf8");
}

test("auth and save surfaces delegate post-auth decisions to the shared pipeline", () => {
  const authModal = read("components/auth/DefaultAuthModal.tsx");
  const saveFlow = read("components/activity/SaveActivityFlowAdaptive.tsx");

  assert.match(authModal, /runPostAuthPipeline\(/);
  assert.match(saveFlow, /runPostAuthPipeline\(/);
  assert.doesNotMatch(saveFlow, /fetch\("\/api\/me\/profile-state"/);
});

test("every completion host delegates final outcome and cleanup to one finalizer", () => {
  const authModal = read("components/auth/DefaultAuthModal.tsx");
  const saveFlow = read("components/activity/SaveActivityFlowAdaptive.tsx");
  const planGate = read("app/(public)/me/plan/PlanProfileCompletionGate.tsx");

  for (const source of [authModal, saveFlow, planGate]) {
    assert.match(source, /finishPostAuthOnboarding\(/);
  }
  assert.match(planGate, /resolvePostAuthFlow\(/);
});
