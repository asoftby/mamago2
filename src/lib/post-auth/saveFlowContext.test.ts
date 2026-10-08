import assert from "node:assert/strict";
import test from "node:test";
import { buildSavePostAuthContext } from "./saveFlowContext";
import { resolvePostAuthFlow } from "./resolver";
import type { ProfileStatePayload } from "./types";

test("callback-backed idea save replaces stale context without serializing a callback", () => {
  assert.deepEqual(
    buildSavePostAuthContext({
      result: { action: "ideas" },
      returnTo: "/current-save?tab=ideas",
      entityType: "activity",
    }),
    {
      source: "save_idea",
      authAction: null,
      pendingAction: null,
      returnTo: "/current-save?tab=ideas",
    },
  );
});

test("callback-backed plan save owns the current source and return target", () => {
  const context = buildSavePostAuthContext({
    result: { action: "plan", dateISO: "2026-10-03" },
    returnTo: "/current-plan",
    entityType: "activity",
  });
  assert.equal(context.source, "save_plan");
  assert.equal(context.returnTo, "/current-plan");
  assert.equal(context.pendingAction, null);
});

test("entity-backed saves retain their serializable pending action", () => {
  assert.deepEqual(
    buildSavePostAuthContext({
      result: {
        action: "plan",
        dateISO: "2026-10-04",
        timeSlotId: "slot-1",
      },
      returnTo: "/event/current",
      entityId: "activity-1",
      entityType: "activity",
      title: "Current event",
      coverImageUrl: "/cover.jpg",
    }).pendingAction,
    {
      kind: "save_plan",
      entityType: "activity",
      entityId: "activity-1",
      plannedDate: "2026-10-04",
      timeSlotId: "slot-1",
      title: "Current event",
      coverImageUrl: "/cover.jpg",
    },
  );
});

test("fresh callback context prevents an old return target from reaching outcome", () => {
  const fresh = buildSavePostAuthContext({
    result: { action: "ideas" },
    returnTo: "/current-save",
    entityType: "activity",
  });
  const completeProfile: ProfileStatePayload = {
    isProfileComplete: true,
    resumeStep: null,
    primaryChildId: "child-1",
    hasAdultProfile: true,
    hasChildProfile: true,
    hasChildInterests: false,
    user: { id: "user-1", familyRole: null, ageBandLabel: null },
    children: [],
  };

  assert.deepEqual(
    resolvePostAuthFlow({
      source: fresh.source,
      returnTo: fresh.returnTo,
      profile: completeProfile,
    }),
    { kind: "done", source: "save_idea", returnTo: "/current-save" },
  );
});
