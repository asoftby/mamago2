import assert from "node:assert/strict";
import test from "node:test";
import { createCollectionGuestAgesStore } from "./collectionGuestAgesStore";

test("all mounted card runs share an age choice and its reset", () => {
  let raw = "";
  let persistedWrites = 0;
  const store = createCollectionGuestAgesStore({
    readRaw: () => raw,
    persistRaw: (next) => { raw = next; persistedWrites++; },
  });
  const snapshotsA: string[] = [];
  const snapshotsB: string[] = [];
  const stopA = store.subscribe(() => snapshotsA.push(store.getSnapshot()));
  const stopB = store.subscribe(() => snapshotsB.push(store.getSnapshot()));

  store.write([3, 7]);
  assert.equal(store.getSnapshot(), "[3,7]");
  store.write([]);
  assert.equal(store.getSnapshot(), "");
  assert.deepEqual(snapshotsA, ["[3,7]", ""]);
  assert.deepEqual(snapshotsB, snapshotsA);
  assert.equal(persistedWrites, 2);

  stopA();
  stopB();
  store.write([5]);
  assert.equal(snapshotsA.length, 2);
  assert.equal(snapshotsB.length, 2);
});

test("a blocked localStorage write still updates all runs through a shared fallback", () => {
  const store = createCollectionGuestAgesStore({
    readRaw: () => { throw new Error("denied"); },
    persistRaw: () => { throw new Error("denied"); },
  });
  const seen: string[] = [];
  const stop = store.subscribe(() => seen.push(store.getSnapshot()));
  assert.equal(store.getServerSnapshot(), "");
  store.write([2]);
  assert.equal(store.getSnapshot(), "[2]");
  // Another run mounted after the first edit sees the exact same snapshot.
  const readBySecondRun = store.getSnapshot();
  assert.equal(readBySecondRun, "[2]");
  store.write([]);
  assert.equal(store.getSnapshot(), "");
  assert.deepEqual(seen, ["[2]", ""]);
  stop();
});

test("a cross-tab storage change replaces a stale fallback for every subscriber", () => {
  let stored = "[6]";
  let denied = true;
  const store = createCollectionGuestAgesStore({
    readRaw: () => stored,
    persistRaw: (value) => {
      if (denied) throw new Error("denied");
      stored = value;
    },
  });
  store.write([2]);
  assert.equal(store.getSnapshot(), "[2]");
  denied = false;
  stored = "[8]";
  store.syncExternalStorageChange();
  assert.equal(store.getSnapshot(), "[8]");
  store.write([]);
  assert.equal(store.getSnapshot(), "");
  assert.equal(stored, "");
});
