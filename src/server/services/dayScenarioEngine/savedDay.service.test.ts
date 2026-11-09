import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { deleteSavedDays, listSavedDayPoints, listSavedDays, parseDeleteRequest, SavedDayError, type SavedDayDeps } from "./savedDay.service";

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
        if ("not" in cond) return row[key] !== cond.not;
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
        const counts = new Map<string, { scenarioId: string; date: string; n: number }>();
        for (const item of state.items.filter((r) => matches(r, where))) {
          const key = `${item.scenarioId}|${item.date}`;
          counts.set(key, { scenarioId: item.scenarioId, date: item.date, n: (counts.get(key)?.n ?? 0) + 1 });
        }
        return [...counts.values()].map((c) => ({ scenarioId: c.scenarioId, date: c.date, _count: { _all: c.n } }));
      },
      findMany: async ({ where, orderBy }: Row) => state.items.filter((r) => matches(r, where)).sort((a, b) => (orderBy ? String(a.startsAt).localeCompare(String(b.startsAt)) : 0)),
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
const item = (id: string, date: string, scenarioId: string | null, userId = "u1") => ({ id, userId, date, scenarioId, activityId: `a-${id}`, routeId: null, placeId: null, articleId: null, startsAt: null, endsAt: null, childId: null, pinned: false });
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

  // ---- the points of a saved day, for «Изменить день»
  {
    const at = (iso: string) => new Date(iso);
    const rows = [
      { ...item("e1", SAT, "s-sat"), startsAt: at("2026-11-14T10:00:00Z"), pinned: true },
      { ...item("pl", SAT, "s-sat"), activityId: null, placeId: "place-9", startsAt: at("2026-11-14T08:00:00Z") },
      { ...item("untimed", SAT, "s-sat"), startsAt: null },
      { ...item("manual", SAT, null), startsAt: at("2026-11-14T09:00:00Z") },
      { ...item("other", SAT, "s-other", "u2"), startsAt: at("2026-11-14T09:30:00Z") },
    ];
    const { tx } = makeDb({ scenarios: scenarios(), items: rows });
    assert.deepEqual(await listSavedDayPoints("u1", SAT, tx), [
      { kind: "place", activityId: "place-9", startsAt: "2026-11-14T08:00:00.000Z", pinned: false },
      { kind: "event", activityId: "a-e1", startsAt: "2026-11-14T10:00:00.000Z", pinned: true },
    ], "only the scenario's timed points, in time order; the place by its place id");
    assert.deepEqual(await listSavedDayPoints("u1", MON, tx), [], "a plan-editor day is not a saved scenario");
    assert.deepEqual(await listSavedDayPoints("u3", SAT, tx), [], "another user's day");
  }

  // ---- a point the user moved to another day is theirs: not counted, not listed, not deleted with the day
  {
    const moved = [...items(), { ...item("moved", "2026-11-20", "s-sat") }];
    const { db, tx, get } = makeDb({ scenarios: scenarios(), items: moved });
    const listed = await listSavedDays("u1", "2026-11-01", "2026-11-30", tx);
    assert.equal(listed[SAT]!.count, 2, "the moved point is not counted on the scenario's day");
    await deleteSavedDays("u1", SAT, "day", deps(db));
    assert.ok(get().items.some((i) => i.id === "moved"), "deleting the day leaves the point the user moved elsewhere");
    assert.ok(!get().items.some((i) => i.id === "p1"), "while the day's own points go");
  }

  // ---- contracts
  {
    const draft = readFileSync("src/server/services/dayScenarioEngine/draft.service.ts", "utf8");
    assert.match(draft, /\{ OR: \[\{ date \}, \{ date: \{ gte: today \} \}\] \}/, "the draft reads the plan from today on, so it does not offer what the save rejects");
    assert.match(draft, /item\.date === date && item\.startsAt/, "another day's entry is planned, not busy time");
    assert.match(draft, /\{ date: \{ not: date \} \}/, "a point of the edited scenario moved to another day stays planned");
  }
  {
    const route = readFileSync("src/app/api/plan/day-scenario/saved/route.ts", "utf8");
    assert.match(route, /if \(!isDayScenarioEngineEnabled\(\)\) return NextResponse\.json\(\{ error: "Not found" \}, \{ status: 404 \}\);\s*try \{\s*const user = await getCurrentUser\(\);/, "404 before any work");
    assert.match(route, /UNAUTHENTICATED[\s\S]*401/);
    assert.match(route, /checkRateLimit\(`day-scenario-delete:\$\{user\.id\}`, 20, 60_000\)/);
    const markers = readFileSync("src/app/api/plan/day-markers/route.ts", "utf8");
    assert.match(markers, /isDayScenarioEngineEnabled\(\) \? listSavedDays\(user\.id, from, to\) : Promise\.resolve\(\{\}\)/, "no extra queries with the flag off");
    assert.match(route, /export async function GET[\s\S]*isDayScenarioEngineEnabled[\s\S]*UNAUTHENTICATED[\s\S]*day-scenario-saved-read/, "the read of a saved day has the same gates");
    const draft = readFileSync("src/server/services/dayScenarioEngine/draft.service.ts", "utf8");
    assert.match(draft, /editScenario: z\.boolean\(\)\.optional\(\)\.default\(false\)/);
    const service = readFileSync("src/server/services/dayScenarioEngine/savedDay.service.ts", "utf8");
    assert.match(service, /planItem\.deleteMany\(\{ where: \{ OR: rows\.map\(\(row\) => \(\{ scenarioId: row\.id, date: row\.date \}\)\), userId \} \}\)/, "only entries of the scenario still on its day, only the user's own");
  }

  console.log("day-scenario saved-day tests passed");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
