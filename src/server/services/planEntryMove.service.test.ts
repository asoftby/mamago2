import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isMovableLinkedEntry, movedTimes, moveLinkedPlanEntry, parseMoveRequest, PlanEntryMoveError, type MoveDeps } from "./planEntryMove.service";

// ---- the same local clock time and length on the new day (Minsk is UTC+3 all year)
{
  const moved = movedTimes(new Date("2026-11-14T08:00:00Z"), new Date("2026-11-14T09:30:00Z"), "2026-11-21");
  assert.equal(moved.startsAt?.toISOString(), "2026-11-21T08:00:00.000Z", "11:00 Minsk stays 11:00 Minsk");
  assert.equal(moved.endsAt?.toISOString(), "2026-11-21T09:30:00.000Z", "same length");
  assert.deepEqual(movedTimes(null, null, "2026-11-21"), { startsAt: null, endsAt: null }, "«в любое время» stays so");
  assert.equal(movedTimes(new Date("2026-11-14T21:30:00Z"), null, "2026-11-21").startsAt?.toISOString(), "2026-11-20T21:30:00.000Z", "00:30 local stays 00:30 local on the new day (still 21:30Z the evening before)");
}

// ---- the request
{
  const ok = parseMoveRequest({ date: "2026-11-21", expectedUpdatedAt: "2026-11-09T10:00:00.000Z" });
  assert.equal(ok.date, "2026-11-21");
  assert.equal(ok.expectedUpdatedAt.toISOString(), "2026-11-09T10:00:00.000Z");
  const code = (body: unknown) => { try { parseMoveRequest(body); } catch (e) { return e instanceof PlanEntryMoveError ? e.code : "other"; } return "none"; };
  assert.equal(code({ date: "21-11-2026", expectedUpdatedAt: "2026-11-09T10:00:00.000Z" }), "INVALID_DATE");
  assert.equal(code({ date: "2026-11-21" }), "INVALID_EXPECTED_UPDATED_AT");
  assert.equal(code({ date: "2026-11-21", expectedUpdatedAt: "nope" }), "INVALID_EXPECTED_UPDATED_AT");
  assert.equal(code(null), "INVALID_DATE");
}

// ---- what this endpoint may move
const link = (over: Record<string, string | null>) => ({ activityId: null, articleId: null, placeId: null, planPlaceSlug: null, offerId: null, routeId: null, planRouteSlug: null, ...over });
assert.equal(isMovableLinkedEntry(link({ placeId: "p" })), true);
assert.equal(isMovableLinkedEntry(link({ offerId: "o" })), true);
assert.equal(isMovableLinkedEntry(link({ planRouteSlug: "r" })), true);
assert.equal(isMovableLinkedEntry(link({ activityId: "a" })), false, "events move through their sessions");
assert.equal(isMovableLinkedEntry(link({ articleId: "ar" })), false);
assert.equal(isMovableLinkedEntry(link({})), false, "a note moves through /api/plan/manual");

// ---- the move, with a tiny in-memory table
type Row = Record<string, unknown> & { id: string; userId: string };
function makeDb(rows: Row[]) {
  const matchesOne = (row: Row, where: Record<string, unknown>): boolean =>
    Object.entries(where).every(([key, cond]) => {
      if (key === "AND") return (cond as Record<string, unknown>[]).every((sub) => matchesOne(row, sub));
      if (cond instanceof Date) return (row[key] as Date | undefined)?.getTime() === cond.getTime();
      return row[key] === cond;
    });
  const db = {
    planItem: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => rows.find((r) => matchesOne(r, where)) ?? null,
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        const hit = rows.filter((r) => matchesOne(r, where));
        for (const r of hit) Object.assign(r, data);
        return { count: hit.length };
      },
    },
  } as unknown as NonNullable<MoveDeps["db"]>;
  return { db, rows };
}
const UPDATED = new Date("2026-11-09T10:00:00.000Z");
const place = (): Row => ({ id: "e1", userId: "u1", date: "2026-11-14", startsAt: new Date("2026-11-14T08:00:00Z"), endsAt: new Date("2026-11-14T09:30:00Z"), updatedAt: UPDATED, activityId: null, articleId: null, placeId: "p1", planPlaceSlug: "park", offerId: null, routeId: null, planRouteSlug: null, scenarioId: "s1" });
const deps = (db: NonNullable<MoveDeps["db"]>): MoveDeps => ({ db, scopeFor: async (userId) => ({ userId }), today: "2026-11-09" });
const req = (date: string, expected = UPDATED) => ({ date, expectedUpdatedAt: expected });
const fails = async (fn: () => Promise<unknown>, status: number, code: string) => assert.rejects(fn, (e: unknown) => e instanceof PlanEntryMoveError && e.status === status && e.code === code, code);

async function run() {
  {
    const { db, rows } = makeDb([place()]);
    const moved = await moveLinkedPlanEntry("u1", "e1", req("2026-11-21"), deps(db));
    assert.equal(moved.date, "2026-11-21");
    assert.equal(moved.startsAt, "2026-11-21T08:00:00.000Z");
    assert.ok(new Date(moved.updatedAt).getTime() > UPDATED.getTime(), "updatedAt moves forward");
    assert.equal(rows[0]!.scenarioId, "s1", "the scenario link is untouched");
    assert.equal(rows[0]!.placeId, "p1");
  }
  await fails(async () => moveLinkedPlanEntry("u1", "e1", req("2026-11-08"), deps(makeDb([place()]).db)), 422, "PAST_DAY");
  await fails(async () => moveLinkedPlanEntry("u2", "e1", req("2026-11-21"), deps(makeDb([place()]).db)), 404, "NOT_FOUND");
  await fails(async () => moveLinkedPlanEntry("u1", "nope", req("2026-11-21"), deps(makeDb([place()]).db)), 404, "NOT_FOUND");
  await fails(async () => moveLinkedPlanEntry("u1", "e1", req("2026-11-21", new Date("2026-11-09T09:00:00.000Z")), deps(makeDb([place()]).db)), 409, "CONFLICT");
  await fails(async () => moveLinkedPlanEntry("u1", "e1", req("2026-11-21"), deps(makeDb([{ ...place(), placeId: null, planPlaceSlug: null, activityId: "a1" }]).db)), 422, "NOT_MOVABLE");
  {
    const stale = makeDb([place()]);
    (stale.db.planItem as unknown as { updateMany: () => Promise<{ count: number }> }).updateMany = async () => ({ count: 0 }); // someone else saved between the read and the write
    await fails(async () => moveLinkedPlanEntry("u1", "e1", req("2026-11-21"), deps(stale.db)), 409, "CONFLICT");
  }

  // ---- contracts
  const route = readFileSync("src/app/api/plan/items/[id]/date/route.ts", "utf8");
  assert.match(route, /UNAUTHENTICATED[\s\S]*401/);
  assert.match(route, /checkRateLimit\(`plan-entry-move:\$\{user\.id\}`, 30, 60_000\)/);
  const sheet = readFileSync("src/features/my-plan/components/v3/PlanMoveSheet.tsx", "utf8");
  assert.match(sheet, /\/api\/plan\/items\/\$\{item\.id\}\/date/, "the move sheet uses the date endpoint for place / offer / route entries");
  const service = readFileSync("src/server/services/planEntryMove.service.ts", "utf8");
  assert.match(service, /where: \{ AND: \[scope, \{ id: itemId, updatedAt: request\.expectedUpdatedAt \}\] \}/, "the write is scoped and guarded by updatedAt");

  console.log("plan entry move tests passed");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
