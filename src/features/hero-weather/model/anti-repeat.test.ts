import assert from "node:assert/strict";

import {
  countRecentMatches,
  pickWeightedNonRepeating,
  pickWeightedRandom,
  selectHeroCopyIdsWithAntiRepeat,
} from "./anti-repeat-engine";
import type { AntiRepeatEntry, AntiRepeatState } from "./anti-repeat-types";
import { loadAntiRepeatState, pruneAntiRepeatState, saveAntiRepeatState } from "./anti-repeat-store";

// --- 1. prune drops old entries ---

{
  const now = 1_000_000_000_000;
  const oldTs = now - 8 * 24 * 60 * 60 * 1000;
  const state: AntiRepeatState = {
    version: 1,
    entries: [
      {
        timestamp: oldTs,
        scenario: "great_outdoor",
        microcopyId: "m1",
        titleId: "t1",
        subtitleId: "s1",
      },
      {
        timestamp: now - 1000,
        scenario: "great_outdoor",
        microcopyId: "m2",
        titleId: "t2",
        subtitleId: "s2",
      },
    ],
  };
  const pruned = pruneAntiRepeatState(state, now);
  assert.equal(pruned.entries.length, 1);
  assert.equal(pruned.entries[0].microcopyId, "m2");
}

// --- 2. pickWeightedNonRepeating avoids blocked id when alternative exists ---

{
  const candidates = [
    { id: "a", weight: 1 },
    { id: "b", weight: 1 },
  ];
  const recentIds = ["x", "y", "a"];
  const picked = pickWeightedNonRepeating(candidates, recentIds, { avoidLastN: 1 });
  assert.ok(picked);
  assert.equal(picked!.id, "b");
}

// --- 3. fallback when only blocked candidate ---

{
  const candidates = [{ id: "only", weight: 1 }];
  const recentIds = ["only", "only", "only"];
  const picked = pickWeightedNonRepeating(candidates, recentIds, { avoidLastN: 3, fallbackToAny: true });
  assert.ok(picked);
  assert.equal(picked!.id, "only");
}

{
  const pickedNone = pickWeightedNonRepeating(
    [{ id: "only", weight: 1 }],
    ["only"],
    { avoidLastN: 1, fallbackToAny: false },
  );
  assert.equal(pickedNone, null);
}

// --- 4. same scenario: try to differ at least 2 fields from last entry ---

{
  const entries: AntiRepeatEntry[] = [
    {
      timestamp: 1,
      scenario: "great_outdoor",
      microcopyId: "m1",
      titleId: "t1",
      subtitleId: "s1",
    },
  ];
  const state: AntiRepeatState = { version: 1, entries };
  const candidateIds = {
    microcopy: [
      { id: "m1", weight: 1 },
      { id: "m2", weight: 1 },
    ],
    titles: [
      { id: "t1", weight: 1 },
      { id: "t2", weight: 1 },
    ],
    subtitles: [
      { id: "s1", weight: 1 },
      { id: "s2", weight: 1 },
    ],
  };

  let sawGood = false;
  for (let i = 0; i < 80; i++) {
    const ids = selectHeroCopyIdsWithAntiRepeat({
      scenario: "great_outdoor",
      candidateIds,
      state,
    });
    assert.ok(ids);
    let diff = 0;
    if (ids!.microcopyId !== "m1") diff++;
    if (ids!.titleId !== "t1") diff++;
    if (ids!.subtitleId !== "s1") diff++;
    if (diff >= 2) {
      sawGood = true;
      break;
    }
  }
  assert.equal(sawGood, true, "expected >=2 fields different from lastSame over trials");
}

// countRecentMatches sanity
{
  const entries: AntiRepeatEntry[] = [
    { timestamp: 1, scenario: "unknown", microcopyId: "a", titleId: "t", subtitleId: "s" },
    { timestamp: 2, scenario: "unknown", microcopyId: "a", titleId: "t", subtitleId: "s" },
    { timestamp: 3, scenario: "unknown", microcopyId: "b", titleId: "t", subtitleId: "s" },
  ];
  assert.equal(countRecentMatches(entries, "microcopyId", "a", 2), 1);
}

// --- 5. storage: SSR / no localStorage (Node) does not throw ---

{
  const s = loadAntiRepeatState();
  assert.equal(s.version, 1);
  assert.ok(Array.isArray(s.entries));
  saveAntiRepeatState({ version: 1, entries: [] });
}

// --- pickWeightedRandom: zero / bad weights → uniform ---

{
  let calls = 0;
  const original = Math.random;
  Math.random = () => {
    calls++;
    return 0.25;
  };
  try {
    const p = pickWeightedRandom([
      { id: "a", weight: 0 },
      { id: "b", weight: 0 },
    ]);
    assert.ok(p);
    assert.equal(calls >= 1, true);
  } finally {
    Math.random = original;
  }
}

 
console.log("anti-repeat tests: OK");
