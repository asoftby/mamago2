import assert from "node:assert/strict";
import {
  buildContentLifecycleViewModel,
  resolveContentLifecycleEffectiveState,
} from "./contentLifecycleViewModel";
import { resolveLifecycleActions } from "./resolveLifecycleActions";

function statusIds(vm: ReturnType<typeof buildContentLifecycleViewModel>) {
  return vm.transitionActions.map((action) => action.id);
}

function testArchivedAdminRestoreAndDeleteArchived() {
  const vm = buildContentLifecycleViewModel({
    type: "offer",
    surface: "admin",
    status: "PUBLISHED",
    archivedAt: "2026-07-01T00:00:00.000Z",
    actorRoles: ["ADMIN"],
    lifecyclePreflight: {
      canDeleteArchived: true,
      canRestore: true,
    },
  });

  assert.deepEqual(statusIds(vm), ["restore", "deleteArchived"]);
}

function testArchivedModeratorRestoreOnly() {
  const vm = buildContentLifecycleViewModel({
    type: "offer",
    surface: "admin",
    status: "PUBLISHED",
    archivedAt: "2026-07-01T00:00:00.000Z",
    actorRoles: ["MODERATOR"],
    lifecyclePreflight: {
      canDeleteArchived: true,
      canRestore: true,
    },
  });

  assert.deepEqual(statusIds(vm), ["restore"]);
}

function testPublishedArchiveOnly() {
  const vm = buildContentLifecycleViewModel({
    type: "place",
    surface: "admin",
    status: "PUBLISHED",
  });

  assert.deepEqual(statusIds(vm), ["archive"]);
  assert.equal(vm.transitionActions.some((a) => a.id === "deleteDraft"), false);
  assert.equal(
    vm.transitionActions.some((a) => a.id === "deleteArchived"),
    false,
  );
}

function testDraftDeleteDraftOnly() {
  const vm = buildContentLifecycleViewModel({
    type: "place",
    surface: "admin",
    status: "DRAFT",
  });

  assert.deepEqual(statusIds(vm), ["deleteDraft"]);
  assert.equal(
    vm.transitionActions.some((a) => a.id === "deleteArchived"),
    false,
  );
}

function testNavigationExcludedFromTransitionMenu() {
  const resolved = resolveLifecycleActions({
    context: {
      contentType: "place",
      surface: "admin",
      status: "PUBLISHED",
      actorRoles: ["ADMIN"],
    },
    navigationLinks: {
      edit: true,
      preview: true,
    },
  });

  assert.ok(resolved.navigationActions.length > 0);
  assert.ok(resolved.transitionActions.length > 0);
  assert.equal(
    resolved.transitionActions.some((action) => action.actionId === "edit"),
    false,
  );
}

function testBlockedArchivedDeleteShowsDisabled() {
  const vm = buildContentLifecycleViewModel({
    type: "place",
    surface: "admin",
    status: "PUBLISHED",
    archivedAt: new Date(),
    actorRoles: ["ADMIN"],
    lifecyclePreflight: {
      canDeleteArchived: false,
      deleteArchivedBlockedReason: "Есть связанные предложения",
    },
  });

  const deleteArchived = vm.transitionActions.find(
    (action) => action.id === "deleteArchived",
  );
  assert.ok(deleteArchived);
  assert.equal(deleteArchived.disabled, true);
  assert.equal(deleteArchived.reason, "Есть связанные предложения");
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

function main() {
  testArchivedAdminRestoreAndDeleteArchived();
  testArchivedModeratorRestoreOnly();
  testPublishedArchiveOnly();
  testDraftDeleteDraftOnly();
  testNavigationExcludedFromTransitionMenu();
  testBlockedArchivedDeleteShowsDisabled();
  testEffectiveStateArchiveWins();
  console.log("contentLifecycleViewModel tests passed");
}

void main();
