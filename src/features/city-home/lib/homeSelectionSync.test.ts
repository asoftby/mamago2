import assert from "node:assert/strict";
import test from "node:test";
import { HomeSelectionSync, persistHomeSelection } from "./homeSelectionSync";
import type { HomeFamilyContext } from "./familyHome";
const base: HomeFamilyContext = { actorId: "adult_a", signature: "profile_same", day: "2030-11-02", policyVersion: "v2", audience: "personalized", selectedChildId: null, preferenceVersion: null, selectionPersistence: "account",
  children: ["child_x", "child_y"].map(id => ({ id, name: id, hasBirthDate: true, ageFilter: [] })) };
function backend() {
  let context = structuredClone(base), revision = 0;
  return {
    context: async () => structuredClone(context),
    save: async (choice: string | null, version: string | null) => {
      if (version !== context.preferenceVersion) throw new Error("home_409");
      context = { ...context, selectedChildId: choice, preferenceVersion: new Date(++revision).toISOString() };
    },
  };
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }

test("A → X, B → Y, A → focus/context → Y with unchanged profile signature", async () => {
  const db = backend(), a = new HomeSelectionSync(base), b = new HomeSelectionSync(base);
  assert.equal(await persistHomeSelection(a, a.begin("child_x"), db), "saved");
  assert.equal(a.reconcile(await db.context()), "child_x");
  assert.equal(await persistHomeSelection(b, b.begin("child_y"), db), "saved");
  const focus = await db.context();
  assert.equal(focus.signature, base.signature, "preference freshness must not depend on ranking fingerprint");
  assert.equal(a.reconcile(focus), "child_y");
});

test("local choice wins during an unfinished write, then server becomes authoritative", async () => {
  const db = backend(), sync = new HomeSelectionSync(base), entered = deferred<void>(), release = deferred<void>();
  const token = sync.begin("child_x");
  const write = persistHomeSelection(sync, token, { ...db, save: async (...args) => { entered.resolve(); await release.promise; await db.save(...args); } });
  await entered.promise;
  await db.save("child_y", null);
  assert.equal(sync.reconcile(await db.context()), "child_x", "focus cannot replace unsaved local intent");
  release.resolve();
  assert.equal(await write, "conflict");
  assert.equal(sync.isPending(token), false);
  assert.equal(sync.reconcile(await db.context()), "child_y", "409 must reconcile, not claim local choice saved");
});

test("two concurrent devices using the same revision: one save, one conflict, both reconcile", async () => {
  const db = backend(), a = new HomeSelectionSync(base), b = new HomeSelectionSync(base);
  const gate = deferred<void>(); let reads = 0;
  const deps = { ...db, context: async () => { const value = await db.context(); if (++reads <= 2) { if (reads === 2) gate.resolve(); await gate.promise; } return value; } };
  const outcomes = await Promise.all([persistHomeSelection(a, a.begin("child_x"), deps), persistHomeSelection(b, b.begin("child_y"), deps)]);
  assert.deepEqual(outcomes.sort(), ["conflict", "saved"]);
  const fresh = await db.context();
  assert.equal(a.reconcile(fresh), fresh.selectedChildId);
  assert.equal(b.reconcile(fresh), fresh.selectedChildId);
});

test("older in-flight save cannot settle a newer local choice; stale context cannot roll back", async () => {
  const db = backend(), sync = new HomeSelectionSync(base), entered = deferred<void>(), release = deferred<void>();
  const first = sync.begin("child_x");
  const older = persistHomeSelection(sync, first, { ...db, save: async (...args) => { entered.resolve(); await release.promise; await db.save(...args); } });
  await entered.promise;
  const second = sync.begin("child_y");
  release.resolve();
  assert.equal(await older, "obsolete");
  assert.equal(sync.reconcile(await db.context()), "child_y");
  assert.equal(await persistHomeSelection(sync, second, db), "saved");
  assert.equal(sync.reconcile(base), "child_y", "late pre-save context must not restore old preference");
});

test("deleted or ACL-inaccessible child cancels pending choice and resets safely", async () => {
  const sync = new HomeSelectionSync(base), token = sync.begin("child_x");
  assert.equal(sync.reconcile({ ...base, children: base.children.slice(1) }), null);
  assert.equal(sync.isPending(token), false);
  const saved = new HomeSelectionSync({ ...base, selectedChildId: "child_x", preferenceVersion: new Date(1).toISOString() });
  assert.equal(saved.reconcile({ ...base, children: base.children.slice(1) }), null, "ACL also resets an already saved choice");
  assert.equal(await persistHomeSelection(sync, token, { context: async () => base, save: async () => { throw new Error("must not write"); } }), "obsolete");
});

test("logout/cancel ignores late save completion; another account is never reconciled", async () => {
  const db = backend(), sync = new HomeSelectionSync(base), entered = deferred<void>(), release = deferred<void>();
  const token = sync.begin("child_x");
  const work = persistHomeSelection(sync, token, { ...db, save: async (...args) => { entered.resolve(); await release.promise; await db.save(...args); } });
  await entered.promise; sync.cancel(); release.resolve();
  assert.equal(await work, "obsolete");
  assert.throws(() => sync.reconcile({ ...base, actorId: "adult_b", selectedChildId: "child_y" }), /selection_actor_changed/);
  assert.equal(new HomeSelectionSync({ ...base, actorId: "adult_b" }).reconcile({ ...base, actorId: "adult_b" }), null);
});

test("failed persistence releases local override and reports failure, never saved", async () => {
  const db = backend(), sync = new HomeSelectionSync(base);
  await db.save("child_y", null);
  assert.equal(await persistHomeSelection(sync, sync.begin("child_x"), { ...db, save: async () => { throw new Error("home_503"); } }), "failed");
  assert.equal(sync.reconcile(await db.context()), "child_y");
});
