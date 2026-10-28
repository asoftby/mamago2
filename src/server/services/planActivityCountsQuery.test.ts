import assert from "node:assert/strict";
import { planCountUnit } from "@/server/family/familyAnalyticsPure";
import { planActivityCountsQuery } from "./planActivityCountsQuery";

type Row = { activityId: string; userId: string; familyId: string | null; status: "CANCELLED" | "CONFIRMED" };
const rows: Row[] = [
  { activityId: "a", userId: "u1", familyId: "f1", status: "CONFIRMED" },
  { activityId: "a", userId: "u2", familyId: "f1", status: "CONFIRMED" },
  { activityId: "a", userId: "u2", familyId: "f1", status: "CONFIRMED" },
  { activityId: "a", userId: "u3", familyId: null, status: "CONFIRMED" },
  { activityId: "a", userId: "u4", familyId: null, status: "CANCELLED" },
  { activityId: "b", userId: "u1", familyId: "f1", status: "CONFIRMED" },
  { activityId: "b", userId: "u2", familyId: "f2", status: "CANCELLED" },
];
function reference(familyReads: boolean) {
  const keys = new Map<string, Set<string>>();
  for (const row of rows) {
    if (familyReads && row.status === "CANCELLED") continue;
    const set = keys.get(row.activityId) ?? new Set<string>();
    set.add(familyReads ? planCountUnit(row) : row.userId);
    keys.set(row.activityId, set);
  }
  return Object.fromEntries([...keys.entries()].map(([k, ids]) => [k, ids.size]));
}
assert.deepEqual(reference(true), { a: 2, b: 1 });
assert.deepEqual(reference(false), { a: 4, b: 2 });
const familySql = planActivityCountsQuery(["a", "b"], true);
const legacySql = planActivityCountsQuery(["a", "b"], false);
const emptySql = planActivityCountsQuery([], true);
assert.match(familySql.sql, /COUNT\(DISTINCT/);
assert.match(familySql.sql, /CASE WHEN "familyId" IS NOT NULL/);
assert.match(familySql.sql, /"status" <> 'CANCELLED'/);
assert.doesNotMatch(legacySql.sql, /"status" <>/);
assert.match(legacySql.sql, /COUNT\(DISTINCT "userId"\)/);
assert.deepEqual(familySql.values, ["a", "b"]);
assert.deepEqual(legacySql.values, ["a", "b"]);
assert.match(emptySql.sql, /WHERE FALSE/);
assert.ok(!familySql.sql.includes("a") || familySql.values.includes("a"), "ids must be parameterized");
console.log("Plan activity SQL aggregation contract: OK");
