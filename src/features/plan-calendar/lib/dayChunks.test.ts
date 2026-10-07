import assert from "node:assert/strict";
import { addDays, diffDays } from "@/lib/date/dateKey";
import { CHUNK_DAYS, MAX_REQUEST_DAYS, chunkEnd, chunkStartsFor } from "./dayChunks";

assert.ok(CHUNK_DAYS <= MAX_REQUEST_DAYS);

// Mobile strip window (±60 days, grown by 30-day edge loads), month grid (42 cells), single day
const today = "2026-10-07";
const windows: Array<[string, string]> = [
  [addDays(today, -60), addDays(today, 60)],
  [addDays(today, -90), addDays(today, 120)],
  [addDays(today, -300), addDays(today, 300)],
  ["2026-09-28", "2026-11-08"],
  [today, today],
  ["2026-12-31", "2027-01-01"],
];

for (const [from, to] of windows) {
  const starts = chunkStartsFor(from, to);
  // every request fits the endpoint limit
  for (const s of starts) assert.ok(diffDays(s, chunkEnd(s)) + 1 <= MAX_REQUEST_DAYS, `${s} too long`);
  // chunks are contiguous and cover the whole window
  assert.ok(starts[0]! <= from && chunkEnd(starts[starts.length - 1]!) >= to);
  for (let i = 1; i < starts.length; i += 1) assert.equal(diffDays(starts[i - 1]!, starts[i]!), CHUNK_DAYS);
}

// overlapping windows reuse the same chunk keys (cache hits)
const a = chunkStartsFor(addDays(today, -60), addDays(today, 60));
const b = chunkStartsFor(addDays(today, -30), addDays(today, 90));
assert.ok(b.filter((s) => a.includes(s)).length >= 3);

console.log("plan-calendar dayChunks.test.ts ok");
