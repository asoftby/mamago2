import assert from "node:assert/strict";
import {
  buildContentLifecycleViewModel,
  resolveContentLifecycleEffectiveState,
} from "./contentLifecycleViewModel";
import {
  LIFECYCLE_FORBIDDEN_TRANSITIONS,
  getLifecycleTransitionsForState,
} from "./lifecycleStateMachine";
import { resolveLifecycleActions } from "./resolveLifecycleActions";

function statusIds(vm: ReturnType<typeof buildContentLifecycleViewModel>) {
  return vm.transitionActions.map((action) => action.id);
}

function testArchivedOfferRestoreOnly() {
  const vm = buildContentLifecycleViewModel({
    type: "offer",
    surface: "admin",
    status: "PUBLISHED",
    archivedAt: "2026-07-01T00:00:00.000Z",
    actorRoles: ["MODERATOR"],
  });

  assert.deepEqual(statusIds(vm), ["restore"]);
}

function testPublishedPlaceArchiveNoDelete() {
  const vm = buildContentLifecycleViewModel({
    type: "place",
    surface: "admin",
    status: "PUBLISHED",
  });

  assert.deepEqual(statusIds(vm), ["archive"]);
  assert.equal(vm.transitionActions.some((a) => a.id === "deleteDraft"), false);
}

function testDraftPlaceDeleteOnlyOnAdmin() {
  const vm = buildContentLifecycleViewModel({
    type: "place",
    surface: "admin",
    status: "DRAFT",
    lifecyclePreflight: { canDeleteDraft: true },
  });

  assert.deepEqual(statusIds(vm), ["deleteDraft"]);
}

function testDraftArticleAdminActions() {
  const vm = buildContentLifecycleViewModel({
    type: "article",
    surface: "admin",
    status: "DRAFT",
  });

  assert.deepEqual(statusIds(vm), [
    "submitForModeration",
    "publish",
    "deleteDraft",
  ]);
}

function testForbiddenTransitionsNeverResolved() {
  for (const rule of LIFECYCLE_FORBIDDEN_TRANSITIONS) {
    const resolved = resolveLifecycleActions({
      context: {
        contentType: "place",
        surface: "admin",
        status:
          rule.from === "published"
            ? "PUBLISHED"
            : rule.from === "archived"
              ? "PUBLISHED"
              : rule.from === "pending"
                ? "PENDING"
                : "DRAFT",
        archivedAt: rule.from === "archived" ? new Date() : null,
        preflight: {
          canDeleteDraft: true,
          canArchive: true,
          canRestore: true,
          canPublish: true,
        },
      },
    });

    const hasForbidden = resolved.transitionActions.some(
      (action) => action.actionId === rule.actionId && !action.disabled,
    );
    assert.equal(
      hasForbidden,
      false,
      `Forbidden ${rule.from} + ${rule.actionId}: ${rule.note}`,
    );
  }
}

function testEffectiveStateArchiveWins() {
  assert.equal(
    resolveContentLifecycleEffectiveState({
      contentType: "offer",
      status: "PUBLISHED",
      archivedAt: new Date(),
    }),
    "archived",
  );
}

function testStateMachineTableCoversAdminSurfaces() {
  const contentTypes = ["place", "offer", "event", "article"] as const;
  for (const contentType of contentTypes) {
    const draftTransitions = getLifecycleTransitionsForState({
      contentType,
      effectiveState: "draft",
      surface: "admin",
      actorRoles: ["ADMIN"],
    });
    assert.ok(
      draftTransitions.length > 0 || contentType === "event",
      `${contentType} draft admin transitions`,
    );
  }
}

function main() {
  testArchivedOfferRestoreOnly();
  testPublishedPlaceArchiveNoDelete();
  testDraftPlaceDeleteOnlyOnAdmin();
  testDraftArticleAdminActions();
  testForbiddenTransitionsNeverResolved();
  testEffectiveStateArchiveWins();
  testStateMachineTableCoversAdminSurfaces();
  console.log("lifecycle state machine tests passed");
}

void main();
