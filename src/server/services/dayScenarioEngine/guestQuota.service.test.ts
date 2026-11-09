import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chargeGuestScenarioDate, guestScenarioChargeFor } from "./guestQuota.service";

// ---- the rule: only the first build of a date costs
assert.deepEqual(guestScenarioChargeFor(null, "2026-11-14", 2), { kind: "charge" }, "a new guest pays for the first date");
assert.deepEqual(guestScenarioChargeFor({ generationsCount: 1, scenarioDates: ["2026-11-14"] }, "2026-11-14", 2), { kind: "free" }, "the same date again is free");
assert.deepEqual(guestScenarioChargeFor({ generationsCount: 1, scenarioDates: ["2026-11-14"] }, "2026-11-15", 2), { kind: "charge" }, "a second date is the second charge");
assert.deepEqual(guestScenarioChargeFor({ generationsCount: 2, scenarioDates: ["2026-11-14", "2026-11-15"] }, "2026-11-21", 2), { kind: "blocked" }, "a third date is over the allowance");
assert.deepEqual(guestScenarioChargeFor({ generationsCount: 2, scenarioDates: ["2026-11-14", "2026-11-15"] }, "2026-11-15", 2), { kind: "free" }, "but a date already built stays free after the allowance is used");
assert.deepEqual(guestScenarioChargeFor({ generationsCount: 2, scenarioDates: null }, "2026-11-14", 2), { kind: "blocked" }, "old guest picks used the allowance: no scenario dates, still blocked");

// ---- the charge, on an in-memory row
type Row = { anonymousId: string; generationsCount: number; scenarioDates: string[] };
function makeDb(seed: Row[] = []) {
  const rows = seed.map((r) => ({ ...r }));
  const tx = {
    guestUsage: {
      findUnique: async ({ where }: { where: { anonymousId: string } }) => rows.find((r) => r.anonymousId === where.anonymousId) ?? null,
      create: async ({ data }: { data: Row }) => void rows.push({ ...data }),
      update: async ({ where, data }: { where: { anonymousId: string }; data: { generationsCount: { increment: number }; scenarioDates: { push: string } } }) => {
        const row = rows.find((r) => r.anonymousId === where.anonymousId)!;
        row.generationsCount += data.generationsCount.increment;
        row.scenarioDates.push(data.scenarioDates.push);
      },
    },
  };
  const db = { $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx) } as unknown as Parameters<typeof chargeGuestScenarioDate>[2];
  return { db, rows };
}

async function run() {
  const { db, rows } = makeDb();
  assert.deepEqual(await chargeGuestScenarioDate("anon:a", "2026-11-14", db, 2), { ok: true, charged: true });
  assert.deepEqual(await chargeGuestScenarioDate("anon:a", "2026-11-14", db, 2), { ok: true, charged: false }, "rebuilding the date is free");
  assert.deepEqual(await chargeGuestScenarioDate("anon:a", "2026-11-15", db, 2), { ok: true, charged: true });
  assert.deepEqual(await chargeGuestScenarioDate("anon:a", "2026-11-21", db, 2), { ok: false, reason: "requires_auth" }, "over the allowance");
  assert.deepEqual([rows[0]!.generationsCount, rows[0]!.scenarioDates], [2, ["2026-11-14", "2026-11-15"]], "two dates, two charges, nothing for the repeats and the refusal");
  assert.deepEqual(await chargeGuestScenarioDate("anon:b", "2026-11-14", db, 2), { ok: true, charged: true }, "another guest has their own allowance");

  // ---- contracts
  const route = readFileSync("src/app/api/plan/day-scenario/draft/route.ts", "utf8");
  assert.match(route, /if \(!user && parsed\.data\.action === "build"\) \{[\s\S]*chargeGuestScenarioDate\(key, parsed\.data\.date\)/, "only a guest's build is charged");
  assert.match(route, /status: 403/, "over the allowance: 403 requires_auth");
  assert.match(route.slice(0, route.indexOf("chargeGuestScenarioDate(key")), /isDayScenarioEngineEnabled/, "behind the flag, before the charge");
  assert.ok(route.indexOf("chargeGuestScenarioDate(key") < route.indexOf("runDayScenarioDraft(parsed.data"), "the charge happens before the draft is computed");
  const migration = readFileSync("prisma/migrations/20261109140000_guest_scenario_dates/migration.sql", "utf8");
  assert.ok(/ALTER TABLE "GuestUsage" ADD COLUMN "scenarioDates" TEXT\[\] DEFAULT ARRAY\[\]::TEXT\[\];/.test(migration) && !/\bDROP\b|DELETE FROM|^UPDATE /m.test(migration), "additive: one array column");
  assert.match(readFileSync("src/server/services/dayScenarioEngine/draft.service.ts", "utf8"), /anonymousId: z\.string\(\)\.uuid\(\)\.optional\(\)/, "the anonymous id is a uuid");

  console.log("day-scenario guest quota tests passed");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
