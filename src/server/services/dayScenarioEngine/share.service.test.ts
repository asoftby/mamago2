import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createOrGetShare, generateShareToken, getSharedDays, isShareToken, parseShareRequest, revokeShares, ShareError } from "./share.service";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- loose in-memory rows stand in for Prisma models
type Row = Record<string, any>;

function makeDb(seed: { scenarios: Row[]; shares?: Row[]; items?: Row[] }) {
  const state = { scenarios: seed.scenarios, shares: seed.shares ?? [], items: seed.items ?? [] };
  let seq = 0;
  const matches = (row: Row, where: Row): boolean =>
    Object.entries(where).every(([key, cond]) => {
      if (cond === undefined) return true;
      if (cond && typeof cond === "object" && !(cond instanceof Date)) {
        if ("in" in cond) return cond.in.includes(row[key]);
        if ("not" in cond) return row[key] !== cond.not;
      }
      return row[key] === cond;
    });
  const db = {
    dayScenario: {
      findUnique: async ({ where }: Row) => state.scenarios.find((r) => r.userId === where.userId_date.userId && r.date === where.userId_date.date) ?? null,
      findMany: async ({ where }: Row) => state.scenarios.filter((r) => matches(r, where)).sort((a, b) => a.date.localeCompare(b.date)),
    },
    dayScenarioShare: {
      findFirst: async ({ where }: Row) => state.shares.filter((r) => matches(r, where))[0] ?? null,
      findUnique: async ({ where }: Row) => state.shares.find((r) => r.token === where.token) ?? null,
      create: async ({ data }: Row) => {
        const row = { id: `sh${++seq}`, revokedAt: null, createdAt: new Date(), ...data };
        state.shares.push(row);
        return row;
      },
      updateMany: async ({ where, data }: Row) => {
        const hit = state.shares.filter((r) => matches(r, where));
        for (const r of hit) Object.assign(r, data);
        return { count: hit.length };
      },
    },
    planItem: { findMany: async ({ where }: Row) => state.items.filter((r) => matches(r, { ...where, startsAt: undefined, cancelledAt: undefined }) && r.startsAt && !r.cancelledAt) },
  } as unknown as Parameters<typeof createOrGetShare>[3] & Parameters<typeof getSharedDays>[1];
  return { db, state };
}

const SAT = "2026-11-14";
const SUN = "2026-11-15";
const scenarios = () => [
  { id: "s-sat", userId: "u1", date: SAT, source: "ENGINE", groupId: "g1" },
  { id: "s-sun", userId: "u1", date: SUN, source: "ENGINE", groupId: "g1" },
  { id: "s-lone", userId: "u1", date: "2026-11-21", source: "ENGINE", groupId: null },
  { id: "s-edit", userId: "u1", date: "2026-11-22", source: null, groupId: null },
  { id: "s-other", userId: "u2", date: SAT, source: "ENGINE", groupId: "gx" },
];
const point = (scenarioId: string, date: string, over: Row = {}) => ({ userId: "u1", scenarioId, date, place: { city: { slug: "minsk" } }, startsAt: new Date(`${date}T08:00:00Z`), title: "Парк", coverImageUrl: null, timeType: "SUGGESTED", locationText: "ул. Парковая 1", planPlaceSlug: "park", placeId: "p1", activity: null, cancelledAt: null, ...over });
const eventPoint = (scenarioId: string, date: string) => point(scenarioId, date, { placeId: null, planPlaceSlug: null, timeType: "CONFIRMED", locationText: null, title: "Концерт", activity: { id: "a1", slug: "koncert", title: "Концерт", coverImageUrl: "c.jpg", place: { title: "Зал", shortAddress: "пр. Независимости 1", formattedAddr: null, customAddress: null, city: { slug: "minsk" } } } });
const code = async (fn: () => Promise<unknown>) => { try { await fn(); } catch (e) { return e instanceof ShareError ? `${e.status}:${e.code}` : "other"; } return "none"; };

async function run() {
  // ---- tokens and requests
  const token = generateShareToken();
  assert.equal(isShareToken(token), true, "32 url-safe characters");
  assert.notEqual(token, generateShareToken(), "never repeats");
  assert.equal(isShareToken("short") || isShareToken("../etc/passwd../etc/passwd../etc/pas") || isShareToken(null), false);
  assert.deepEqual(parseShareRequest(SAT, "group"), { date: SAT, scope: "group" });
  assert.throws(() => parseShareRequest("bad", "day"), (e: unknown) => e instanceof ShareError && e.code === "INVALID_DATE");
  assert.throws(() => parseShareRequest(SAT, "all"), (e: unknown) => e instanceof ShareError && e.code === "INVALID_SCOPE");

  // ---- making a link: one per target, reused; only for the user's own saved scenario
  {
    const { db, state } = makeDb({ scenarios: scenarios() });
    const first = await createOrGetShare("u1", SAT, "day", db, () => "A".repeat(32));
    assert.equal(first.token, "A".repeat(32));
    assert.equal((await createOrGetShare("u1", SAT, "day", db, () => "B".repeat(32))).token, first.token, "the open link is reused");
    assert.equal(state.shares.length, 1);
    assert.equal(state.shares[0]!.groupId, null, "a day link has no group");
    const weekend = await createOrGetShare("u1", SUN, "group", db, () => "C".repeat(32));
    assert.notEqual(weekend.token, first.token, "a weekend link is its own");
    assert.equal(state.shares[1]!.groupId, "g1");
    assert.equal((await createOrGetShare("u1", SAT, "group", db, () => "D".repeat(32))).token, weekend.token, "the weekend link is found from either day");
    assert.equal((await createOrGetShare("u1", "2026-11-21", "group", db, () => "E".repeat(32))).token, "E".repeat(32), "a day without a group falls back to a day link");
    assert.equal(await code(() => createOrGetShare("u1", "2026-11-22", "day", db)), "404:NOT_A_SAVED_DAY", "a plan-editor day is not shareable");
    assert.equal(await code(() => createOrGetShare("u3", SAT, "day", db)), "404:NOT_A_SAVED_DAY", "another user's day");
  }

  // ---- closing links
  {
    const { db, state } = makeDb({ scenarios: scenarios() });
    await createOrGetShare("u1", SAT, "day", db, () => "A".repeat(32));
    await createOrGetShare("u1", SAT, "group", db, () => "C".repeat(32));
    assert.deepEqual(await revokeShares("u1", SUN, "group", db), { closed: 2 }, "closing the weekend (from either day) closes every open link of its days");
    assert.ok(state.shares.every((s) => s.revokedAt), "the weekend link and the day link are both closed");
    assert.deepEqual(await revokeShares("u1", SAT, "day", db), { closed: 0 }, "idempotent");
    assert.equal((await createOrGetShare("u1", SAT, "day", db, () => "F".repeat(32))).token, "F".repeat(32), "after closing, a new link is a new token");
  }

  // ---- a weekend link whose group was broken (the anchor day saved on its own) still closes
  {
    const { db, state } = makeDb({ scenarios: scenarios() });
    await createOrGetShare("u1", SAT, "group", db, () => "W".repeat(32));
    for (const s of state.scenarios.filter((r) => r.groupId === "g1")) s.groupId = null; // each day saved on its own
    assert.deepEqual(await revokeShares("u1", SAT, "day", db), { closed: 1 }, "the day scope also closes the old weekend link anchored there");
    assert.equal(await getSharedDays("W".repeat(32), db), null, "and it shows nothing any more");
    const second = makeDb({ scenarios: scenarios() });
    await createOrGetShare("u1", SAT, "day", second.db, () => "A".repeat(32));
    await createOrGetShare("u1", SAT, "group", second.db, () => "B".repeat(32));
    assert.deepEqual(await revokeShares("u1", SAT, "group", second.db), { closed: 2 }, "closing the weekend closes every open link of its days");
  }

  // ---- the public read
  {
    const items = [eventPoint("s-sat", SAT), point("s-sat", SAT), point("s-sun", SUN, { place: { city: { slug: "grodno" } } }), point("s-sat", "2026-11-30", { title: "Перенесённая" }), point("s-other", SAT, { userId: "u2" })];
    const { db, state } = makeDb({ scenarios: scenarios(), items, shares: [
      { token: "W".repeat(32), userId: "u1", date: SAT, groupId: "g1", revokedAt: null },
      { token: "D".repeat(32), userId: "u1", date: SAT, groupId: null, revokedAt: null },
      { token: "X".repeat(32), userId: "u1", date: SAT, groupId: null, revokedAt: new Date() },
    ] });
    const weekend = (await getSharedDays("W".repeat(32), db))!;
    assert.deepEqual(weekend.map((d) => [d.date, d.points.length]), [[SAT, 2], [SUN, 1]], "both days of the weekend; the point moved to another day is not shown");
    assert.equal(weekend[1]!.points[0]!.href, "/grodno/places/park", "a place link uses the place's own city");
    const day = (await getSharedDays("D".repeat(32), db))!;
    assert.deepEqual(day.map((d) => d.date), [SAT], "a day link shows that day only");
    const concert = day[0]!.points.find((p) => p.kind === "event")!;
    assert.deepEqual([concert.title, concert.suggestedTime, concert.locationText, concert.href, concert.coverUrl], ["Концерт", false, "пр. Независимости 1", "/minsk/events/koncert", "c.jpg"]);
    const park = day[0]!.points.find((p) => p.kind === "place")!;
    assert.deepEqual([park.suggestedTime, park.locationText, park.href], [true, "ул. Парковая 1", "/minsk/places/park"]);
    assert.deepEqual(Object.keys(park).sort(), ["coverUrl", "href", "kind", "locationText", "startsAt", "suggestedTime", "title"], "nothing about the owner");
    assert.equal(await getSharedDays("X".repeat(32), db), null, "a closed link shows nothing");
    assert.equal(await getSharedDays("Z".repeat(32), db), null, "an unknown token");
    assert.equal(await getSharedDays("not-a-token", db), null, "a malformed token never reaches the database");
    // live: the weekend saved again gets a new group id, the link still works
    for (const s of state.scenarios.filter((r) => r.groupId === "g1")) s.groupId = "g2";
    assert.equal((await getSharedDays("W".repeat(32), db))!.length, 2, "a weekend link survives saving the weekend again");
    // the day is deleted: the link goes dead
    for (const s of state.scenarios.filter((r) => r.userId === "u1" && (r.date === SAT || r.date === SUN))) { s.source = null; s.groupId = null; }
    assert.equal(await getSharedDays("W".repeat(32), db), null, "deleting the day kills its links");
  }

  // ---- contracts
  const route = readFileSync("src/app/api/plan/day-scenario/share/route.ts", "utf8");
  assert.match(route, /if \(!isDayScenarioEngineEnabled\(\)\) return NextResponse\.json\(\{ error: "Not found" \}, \{ status: 404 \}\);\s*try \{\s*const user = await getCurrentUser\(\);/, "404 before any work");
  assert.match(route, /UNAUTHENTICATED[\s\S]*401/);
  assert.match(route, /checkRateLimit\(`day-scenario-share:\$\{user\.id\}`, 20, 60_000\)/);
  const page = readFileSync("src/app/(public)/d/[token]/page.tsx", "utf8");
  assert.match(page, /robots: \{ index: false, follow: false \}/, "never indexed");
  assert.match(page, /referrer: "no-referrer"/, "the token does not leak through Referer");
  assert.match(page, /if \(!isDayScenarioEngineEnabled\(\)\) notFound\(\);/, "dead with the flag off");
  assert.match(page, /export const dynamic = "force-dynamic"/);
  const migration = readFileSync("prisma/migrations/20261109130000_day_scenario_share/migration.sql", "utf8");
  assert.ok(/CREATE TABLE "DayScenarioShare"/.test(migration) && !/\bDROP\b|DELETE FROM|^UPDATE |ALTER TABLE "(?!DayScenarioShare)/m.test(migration), "additive: one new table");
  const menu = readFileSync("src/features/my-plan/components/dayScenario/SavedDayMenu.tsx", "utf8");
  for (const text of ["Поделиться выходными", "Закрыть ссылку", "/api/plan/day-scenario/share?date="]) assert.ok(menu.includes(text), text);

  console.log("day-scenario share tests passed");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
