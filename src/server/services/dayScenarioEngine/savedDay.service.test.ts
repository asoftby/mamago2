import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { deleteSavedDays, listSavedDays, parseDeleteRequest, SavedDayError, type SavedDayDeps } from "./savedDay.service";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- a loose in-memory row stands in for Prisma models
type Row = Record<string, any>;

function makeDb(seed: { scenarios: Row[]; items: Row[] }) {
  let state: { scenarios: Row[]; items: Row[] } = { scenarios: seed.scenarios.map((r) => ({ acceptedConflictKeys: [], legsJson: "legs", planFingerprint: "old", ...r })), items: seed.items.map((r) => ({ cancelledAt: null, ...r })) };
  const matches = (row: Row, where: Row): boolean =>
    Object.entries(where).every(([key, cond]) => {
      if (key === "AND") return (cond as Row[]).every((sub) => matches(row, sub));
      if (key === "OR") return (cond as Row[]).some((sub) => matches(row, sub));
      if (cond && typeof cond === "object" && !(cond instanceof Date)) {
        if ("in" in cond) return cond.in.includes(row[key]);
        if ("gte" in cond || "lte" in cond) return (cond.gte === undefined || row[key] >= cond.gte) && (cond.lte === undefined || row[key] <= cond.lte);
      }
      return row[key] === cond;
    });
  const tx = {
    $queryRaw: async () => [],
    dayScenario: {
      findMany: async ({ where }: Row) => state.scenarios.filter((r) => matches(r, where)).sort((a, b) => a.date.localeCompare(b.date)),
      findUnique: async ({ where }: Row) => state.scenarios.find((r) => r.userId === where.userId_date.userId && r.date === where.userId_date.date) ?? null,
      update: async ({ where, data }: Row) => {
        const row = state.scenarios.find((r) => r.id === where.id)!;
        for (const [key, value] of Object.entries(data)) row[key] = value && typeof value === "object" && "_getName" in value ? null : value;
        return row;
      },
    },
    planItem: {
      groupBy: async ({ where }: Row) => {
        const counts = new Map<string, number>();
        for (const item of state.items.filter((r) => matches(r, where))) counts.set(item.scenarioId, (counts.get(item.scenarioId) ?? 0) + 1);
        return [...counts].map(([scenarioId, n]) => ({ scenarioId, _count: { _all: n } }));
      },
      findMany: async ({ where }: Row) => state.items.filter((r) => matches(r, where)),
      deleteMany: async ({ where }: Row) => {
        const before = state.items.length;
        state.items = state.items.filter((r) => !matches(r, where));
        return { count: before - state.items.length };
      },
    },
  };
  const db = {
    $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => {
      const snapshot = structuredClone(state);
      try {
        return await fn(tx);
      } catch (error) {
        state = snapshot;
        throw error;
      }
    },
  } as unknown as NonNullable<SavedDayDeps["db"]>;
  return { db, tx: tx as unknown as Parameters<typeof listSavedDays>[3], get: () => state };
}

const SAT = "2026-11-14";
const SUN = "2026-11-15";
const MON = "2026-11-16";
const scenarios = () => [
  { id: "s-sat", userId: "u1", date: SAT, source: "ENGINE", groupId: "g1" },
  { id: "s-sun", userId: "u1", date: SUN, source: "ENGINE", groupId: "g1" },
  { id: "s-mon", userId: "u1", date: MON, source: null, groupId: null }, // a plan-editor day
  { id: "s-other", userId: "u2", date: SAT, source: "ENGINE", groupId: "gx" },
];
const item = (id: string, date: string, scenarioId: string | null, userId = "u1") => ({ id, userId, date, scenarioId, activityId: `a-${id}`, routeId: null, placeId: null, articleId: null, startsAt: null, endsAt: null, childId: null });
const items = () => [item("p1", SAT, "s-sat"), item("p2", SAT, "s-sat"), item("m1", SAT, null), item("p3", SUN, "s-sun"), item("m2", SUN, null), item("o1", SAT, "s-other", "u2")];
const deps = (db: NonNullable<SavedDayDeps["db"]>): SavedDayDeps => ({ db, scopeFor: async (userId) => ({ userId }) });

async function run() {
  // ---- request parsing
  assert.deepEqual(parseDeleteRequest(SAT, "day"), { date: SAT, scope: "day" });
  assert.throws(() => parseDeleteRequest("14-11-2026", "day"), (e: unknown) => e instanceof SavedDayError && e.code === "INVALID_DATE");
  assert.throws(() => parseDeleteRequest(null, "day"), (e: unknown) => e instanceof SavedDayError && e.code === "INVALID_DATE");
  assert.throws(() => parseDeleteRequest(SAT, "all"), (e: unknown) => e instanceof SavedDayError && e.code === "INVALID_SCOPE");

  // ---- the list: the user's engine days with their points; plan-editor days, other users and emptied days are not listed
  {
    const { tx } = makeDb({ scenarios: scenarios(), items: items() });
    const listed = await listSavedDays("u1", "2026-11-01", "2026-11-30", tx);
    assert.deepEqual(listed, { [SAT]: { scenarioId: "s-sat", groupId: "g1", count: 2 }, [SUN]: { scenarioId: "s-sun", groupId: "g1", count: 1 } });
    assert.deepEqual(await listSavedDays("u1", SUN, SUN, tx), { [SUN]: { scenarioId: "s-sun", groupId: "g1", count: 1 } }, "the range is honoured");
    assert.deepEqual(await listSavedDays("u1", "2026-12-01", "2026-12-31", tx), {}, "nothing in range: no second query is needed");
    const emptied = makeDb({ scenarios: scenarios(), items: items().filter((i) => i.scenarioId !== "s-sun") });
    assert.deepEqual(Object.keys(await listSavedDays("u1", "2026-11-01", "2026-11-30", emptied.tx)), [SAT], "a saved day whose points were all deleted by hand is not listed");
  }

  // ---- delete one day: its own points go, manual ones and the other day stay, the row stops being «от mamaGo»
  {
    const { db, get } = makeDb({ scenarios: scenarios(), items: items() });
    const result = await deleteSavedDays("u1", SAT, "day", deps(db));
    assert.deepEqual(result, { dates: [SAT] });
    assert.deepEqual(get().items.map((i) => i.id).sort(), ["m1", "m2", "o1", "p3"], "only this scenario's points are deleted");
    const sat = get().scenarios.find((r) => r.id === "s-sat")!;
    assert.deepEqual([sat.source, sat.groupId, sat.legsJson], [null, null, null]);
    assert.notEqual(sat.planFingerprint, "old", "the editor's fingerprint is recomputed for what is left");
    assert.equal(get().scenarios.find((r) => r.id === "s-sun")!.source, "ENGINE", "the other day of the weekend is untouched");
  }

  // ---- delete the weekend: both days of the group, nothing of anyone else's
  {
    const { db, get } = makeDb({ scenarios: scenarios(), items: items() });
    const result = await deleteSavedDays("u1", SUN, "group", deps(db));
    assert.deepEqual(result, { dates: [SAT, SUN] }, "dates in order");
    assert.deepEqual(get().items.map((i) => i.id).sort(), ["m1", "m2", "o1"]);
    assert.ok(get().scenarios.filter((r) => r.userId === "u1").every((r) => r.source === null && r.groupId === null));
    assert.equal(get().scenarios.find((r) => r.id === "s-other")!.source, "ENGINE", "another user's saved day is not touched");
  }

  // ---- a day without a group: «group» removes just that day; not a saved day: 404 and nothing changes
  {
    const lone = makeDb({ scenarios: [{ id: "s-lone", userId: "u1", date: SAT, source: "ENGINE", groupId: null }], items: [item("p1", SAT, "s-lone"), item("m1", SAT, null)] });
    assert.deepEqual(await deleteSavedDays("u1", SAT, "group", deps(lone.db)), { dates: [SAT] });
    assert.deepEqual(lone.get().items.map((i) => i.id), ["m1"]);
    const plain = makeDb({ scenarios: scenarios(), items: items() });
    for (const date of [MON, "2026-12-24"]) {
      await assert.rejects(deleteSavedDays("u1", date, "day", deps(plain.db)), (e: unknown) => e instanceof SavedDayError && e.status === 404 && e.code === "NOT_A_SAVED_DAY");
    }
    await assert.rejects(deleteSavedDays("u3", SAT, "day", deps(plain.db)), (e: unknown) => e instanceof SavedDayError && e.status === 404, "another user has no such day");
    assert.equal(plain.get().items.length, items().length, "nothing was deleted");
  }

  // ---- contracts
  {
    const route = readFileSync("src/app/api/plan/day-scenario/saved/route.ts", "utf8");
    assert.match(route, /if \(!isDayScenarioEngineEnabled\(\)\) return NextResponse\.json\(\{ error: "Not found" \}, \{ status: 404 \}\);\s*try \{\s*const user = await getCurrentUser\(\);/, "404 before any work");
    assert.match(route, /UNAUTHENTICATED[\s\S]*401/);
    assert.match(route, /checkRateLimit\(`day-scenario-delete:\$\{user\.id\}`, 20, 60_000\)/);
    const markers = readFileSync("src/app/api/plan/day-markers/route.ts", "utf8");
    assert.match(markers, /isDayScenarioEngineEnabled\(\) \? listSavedDays\(user\.id, from, to\) : Promise\.resolve\(\{\}\)/, "no extra queries with the flag off");
    const service = readFileSync("src/server/services/dayScenarioEngine/savedDay.service.ts", "utf8");
    assert.match(service, /planItem\.deleteMany\(\{ where: \{ scenarioId: \{ in: rows\.map\(\(row\) => row\.id\) \}, userId \} \}\)/, "only entries of the scenario, only the user's own");
  }

  console.log("day-scenario saved-day tests passed");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
