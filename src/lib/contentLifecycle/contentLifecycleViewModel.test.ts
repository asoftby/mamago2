import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildContentLifecycleViewModel,
  resolveContentLifecycleEffectiveState,
} from "./contentLifecycleViewModel";
import { resolveLifecycleActions } from "./resolveLifecycleActions";

const __dirname = dirname(fileURLToPath(import.meta.url));

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

function testAdminContentListEntityTypesResolve() {
  // Admin content list pages call buildContentLifecycleViewModel per row.
  // A production minify bug previously crashed these with
  // ReferenceError: effectiveState is not defined.
  for (const type of ["place", "offer", "event", "article", "route"] as const) {
    const vm = buildContentLifecycleViewModel({
      type,
      surface: "admin",
      status: "PUBLISHED",
      actorRoles: ["ADMIN"],
    });
    assert.equal(typeof vm.effectiveState, "string", type);
    assert.ok(Array.isArray(vm.transitionActions), type);
    assert.ok(vm.badges.length > 0, type);
  }
}

function testTransitionBindingAvoidsMinifyShorthandTrap() {
  // Guard the source shape that SWC/webpack mangled into a bare identifier.
  const source = readFileSync(join(__dirname, "resolveLifecycleActions.ts"), "utf8");
  assert.match(source, /effectiveState:\s*state/);
  assert.doesNotMatch(
    source,
    /getLifecycleTransitionsForState\(\{\s*contentType:[^,]+,\s*effectiveState,/,
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
  testAdminContentListEntityTypesResolve();
  testTransitionBindingAvoidsMinifyShorthandTrap();
  console.log("contentLifecycleViewModel tests passed");
}

void main();
