import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DaySaveError, requestHashOf, saveDayScenarios, saveRequestSchema, timeTypeFor, validateSaveRequest, type SaveDeps, type SaveRequest } from "./save.service";

// ---------------------------------------------------------------- in-memory database with real rollback

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- a loose in-memory row stands in for Prisma models
type Row = Record<string, any>;
function makeDb(seed: { activities?: Row[]; places?: Row[]; planItems?: Row[] } = {}) {
  let state = { dayScenarios: [] as Row[], planItems: (seed.planItems ?? []).map((r) => ({ ...r })), activities: seed.activities ?? [], places: seed.places ?? [] };
  let seq = 0;
  const matches = (row: Row, where: Row): boolean =>
    Object.entries(where).every(([key, cond]) => {
      if (key === "OR") return (cond as Row[]).some((sub) => matches(row, sub));
      if (key === "AND") return (cond as Row[]).every((sub) => matches(row, sub));
      if (cond && typeof cond === "object" && "in" in cond) return (cond as { in: unknown[] }).in.includes(row[key]);
      if (cond && typeof cond === "object" && !(cond instanceof Date)) return matches(row[key] ?? {}, cond as Row);
      return row[key] === cond;
    });
  const tx = {
    $queryRaw: async () => [],
    dayScenario: {
      upsert: async ({ where, create }: Row) => {
        const { userId, date } = where.userId_date;
        const found = state.dayScenarios.find((r) => r.userId === userId && r.date === date);
        if (found) return found;
        const row = { id: `sc${++seq}`, acceptedConflictKeys: [], lastSaveIdempotencyKey: null, lastSaveRequestHash: null, lastSaveResponse: null, groupId: null, source: null, legsJson: null, ...create };
        state.dayScenarios.push(row);
        return row;
      },
      findMany: async ({ where }: Row) => state.dayScenarios.filter((r) => matches(r, where)).sort((a, b) => a.date.localeCompare(b.date)),
      update: async ({ where, data }: Row) => Object.assign(state.dayScenarios.find((r) => r.id === where.id)!, data),
    },
    activity: { findMany: async ({ where }: Row) => state.activities.filter((a) => where.id.in.includes(a.id) && a.status === where.status).map((a) => ({ ...a, _count: { sessions: a.allSessions ?? a.sessions.length } })) },
    place: { findMany: async ({ where }: Row) => state.places.filter((p) => where.id.in.includes(p.id)) },
    planItem: {
      findMany: async ({ where }: Row) => state.planItems.filter((r) => matches(r, where)),
      deleteMany: async ({ where }: Row) => {
        const before = state.planItems.length;
        state.planItems = state.planItems.filter((r) => !matches(r, where));
        return { count: before - state.planItems.length };
      },
      update: async ({ where, data }: Row) => Object.assign(state.planItems.find((r) => r.id === where.id)!, data),
      create: async ({ data }: Row) => {
        const row = { id: `pi${++seq}`, scenarioId: null, ...data };
        state.planItems.push(row);
        return row;
      },
    },
  };
  const db = {
    $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => {
      const snapshot = structuredClone(state);
      try {
        return await fn(tx);
      } catch (error) {
        state = snapshot; // a failed transaction leaves nothing behind
        throw error;
      }
    },
  } as unknown as NonNullable<SaveDeps["db"]>;
  return { db, get: () => state };
}

const SAT = "2026-11-14";
const SUN = "2026-11-15";
const at = (date: string, utcHm: string) => `${date}T${utcHm}:00.000Z`; // 08:00Z = 11:00 Minsk
const eventItem = (id: string, date: string, utc: string, endUtc: string) => ({ kind: "event" as const, activityId: id, startsAt: at(date, utc), endsAt: at(date, endUtc), pinned: false, travel: null });
const placeItem = (id: string, date: string, utc: string, endUtc: string, travel: SaveRequest["days"][number]["items"][number]["travel"] = null) => ({ kind: "place" as const, activityId: id, startsAt: at(date, utc), endsAt: at(date, endUtc), pinned: false, travel });
const deps = (db: NonNullable<SaveDeps["db"]>): SaveDeps => ({ db, scopeFor: async (userId) => ({ userId }), familyIdFor: async () => "fam1", today: "2026-11-08" });

const WEEKLY_RULE = { scheduleItems: [{ date: "2026-11-07", startTime: "11:00", recurringEnabled: true, recurrenceInterval: 1, recurrenceUnit: "week", recurrenceUntil: "2027-02-01" }] };
const session = (iso: string, withdrawn = false) => ({ startsAt: new Date(iso), withdrawnAt: withdrawn ? new Date("2026-11-01T00:00:00Z") : null });
const concert = { id: "ev-session", title: "Концерт", coverImageUrl: "c.jpg", status: "PUBLISHED", scheduleJson: null, sessions: [session(at(SAT, "08:00"))] };
const weekly = { id: "ev-weekly", title: "Еженедельное занятие", coverImageUrl: null, status: "PUBLISHED", scheduleJson: WEEKLY_RULE, sessions: [] };
// ONE_TIME / MULTI_DATE events have rules too: the pool expands them when no session row exists
const multiNoSession = { id: "ev-multi", title: "Многодатное без сеансов", coverImageUrl: null, status: "PUBLISHED", scheduleJson: { dates: [SAT], startTime: "11:00", scheduleItems: [{ date: SAT, startTime: "11:00" }] }, sessions: [] };
const withdrawn = { id: "ev-withdrawn", title: "Сеанс отозван", coverImageUrl: null, status: "PUBLISHED", scheduleJson: { dates: [SAT], startTime: "11:00", scheduleItems: [{ date: SAT, startTime: "11:00" }] }, sessions: [session(at(SAT, "08:00"), true)] };
const oneTimeNoSession = { id: "ev-nosession", title: "Без сеансов и правил", coverImageUrl: null, status: "PUBLISHED", scheduleJson: null, sessions: [] };
const draftEvent = { id: "ev-draft", title: "Черновик", coverImageUrl: null, status: "DRAFT", scheduleJson: WEEKLY_RULE, sessions: [] };
const park = { id: "pl-park", slug: "park", title: "Парк", shortAddress: "ул. Парковая 1", formattedAddr: null, customAddress: null, images: [{ url: "p.jpg" }] };
const cafe = { id: "pl-cafe", slug: "cafe", title: "Кафе", shortAddress: null, formattedAddr: " ул. Кафейная 2 ", customAddress: null, images: [] };
const seedCatalog = () => ({ activities: [concert, weekly, multiNoSession, withdrawn, oneTimeNoSession, draftEvent], places: [park, cafe] });

async function run() {
  // ---- request validation without a database
  assert.equal(saveRequestSchema.safeParse({ days: [] }).success, false, "at least one day");
  assert.equal(saveRequestSchema.safeParse({ days: [{ date: SAT, items: [] }] }).success, false, "at least one point");
  assert.equal(saveRequestSchema.safeParse({ days: [SAT, SUN, "2026-11-16"].map((date) => ({ date, items: [eventItem("a", date, "08:00", "09:30")] })) }).success, false, "two days at most");
  const parse = (days: unknown) => saveRequestSchema.parse({ days });
  const code = (fn: () => void) => { try { fn(); } catch (error) { return error instanceof DaySaveError ? error.code : "other"; } return "none"; };
  assert.equal(code(() => validateSaveRequest(parse([{ date: "2026-11-07", items: [eventItem("a", "2026-11-07", "08:00", "09:30")] }]), "2026-11-08")), "PAST_DAY");
  assert.equal(code(() => validateSaveRequest(parse([{ date: SAT, items: [eventItem("a", SAT, "08:00", "09:30")] }, { date: SAT, items: [eventItem("b", SAT, "08:00", "09:30")] }]), "2026-11-08")), "DUPLICATE_DAY");
  assert.equal(code(() => validateSaveRequest(parse([{ date: SAT, items: [eventItem("a", SAT, "08:00", "09:30"), eventItem("a", SAT, "11:00", "12:30")] }]), "2026-11-08")), "DUPLICATE_POINT");
  assert.equal(code(() => validateSaveRequest(parse([{ date: SAT, items: [eventItem("a", SAT, "10:00", "09:00")] }]), "2026-11-08")), "INVALID_TIME", "ends before it starts");
  assert.equal(code(() => validateSaveRequest(parse([{ date: SAT, items: [eventItem("a", SUN, "08:00", "09:30")] }]), "2026-11-08")), "INVALID_TIME", "start on another local day");
  assert.equal(code(() => validateSaveRequest(parse([{ date: SAT, items: [eventItem("a", SAT, "08:00", "09:30")] }]), "2026-11-08")), "none");
  const a = parse([{ date: SAT, items: [eventItem("a", SAT, "08:00", "09:30"), placeItem("b", SAT, "11:00", "12:30")] }, { date: SUN, items: [eventItem("c", SUN, "08:00", "09:30")] }]);
  const b = parse([{ date: SUN, items: [eventItem("c", SUN, "08:00", "09:30")] }, { date: SAT, items: [placeItem("b", SAT, "11:00", "12:30"), eventItem("a", SAT, "08:00", "09:30")] }]);
  assert.equal(requestHashOf(a), requestHashOf(b), "the hash does not depend on the order of days and points");
  assert.notEqual(requestHashOf(a), requestHashOf(parse([{ date: SAT, items: [eventItem("a", SAT, "08:00", "09:30")] }])));

  // ---- time type: judged like the draft pool judged it
  const asEvent = (e: { sessions: { startsAt: Date; withdrawnAt: Date | null }[]; scheduleJson: unknown }) => ({ ...e, _count: { sessions: e.sessions.length } });
  const t = (kind: "event" | "place", iso: string, event: ReturnType<typeof asEvent> | null) => timeTypeFor(kind, new Date(iso).getTime(), event, SAT);
  const refused = (fn: () => unknown) => assert.throws(fn, (e: unknown) => e instanceof DaySaveError && e.code === "INVALID_OCCURRENCE");
  assert.equal(t("event", at(SAT, "08:00"), asEvent(concert)), "CONFIRMED", "an active session at exactly this start");
  assert.equal(t("event", at(SAT, "08:00"), asEvent(weekly)), "SUGGESTED", "a weekly rule, no session row");
  assert.equal(t("event", at(SAT, "08:00"), asEvent(multiNoSession)), "SUGGESTED", "a ONE_TIME / MULTI_DATE event with rules and no session is saved too");
  assert.equal(t("place", at(SAT, "09:00"), null), "SUGGESTED", "a place: the time is the engine's");
  refused(() => t("event", at(SAT, "09:00"), asEvent(weekly))); // a start the rule does not have
  refused(() => t("event", at(SAT, "08:00"), asEvent(withdrawn))); // a withdrawn session is not resurrected, nor replaced by its rule
  refused(() => t("event", at(SAT, "08:00"), asEvent(oneTimeNoSession))); // nothing puts an occurrence there
  refused(() => t("event", at(SAT, "10:00"), asEvent(concert))); // a session exists, just not at this start (and the event has sessions: no rule fallback)

  // ---- one day: entries created, scenario marked, legs and fingerprint stored, manual entries untouched
  {
    const manual = { id: "manual1", userId: "u1", date: SAT, activityId: null, placeId: null, title: "Бассейн", startsAt: new Date(at(SAT, "13:00")), scenarioId: null };
    const { db, get } = makeDb({ ...seedCatalog(), planItems: [manual] });
    const request = parse([{ date: SAT, items: [eventItem("ev-session", SAT, "08:00", "09:30"), placeItem("pl-park", SAT, "10:30", "12:00", { mode: "car", minutes: 15, distanceM: 6000 })] }]);
    const response = await saveDayScenarios("u1", request, "key-one-0001", deps(db));
    assert.equal(response.groupId, null, "a single day has no group");
    assert.equal(response.days.length, 1);
    assert.deepEqual(response.days[0]!.items.map((i) => [i.activityId, i.timeType]), [["ev-session", "CONFIRMED"], ["pl-park", "SUGGESTED"]]);
    const created = get().planItems.filter((r) => r.id !== "manual1");
    assert.equal(created.length, 2);
    assert.ok(created.every((r) => r.scenarioId === get().dayScenarios[0]!.id && r.userId === "u1" && r.familyId === "fam1" && r.date === SAT));
    const parkRow = created.find((r) => r.placeId === "pl-park")!;
    assert.equal(parkRow.planPlaceSlug, "park");
    assert.equal(parkRow.locationText, "ул. Парковая 1", "a place point keeps its address on the entry");
    assert.equal("locationText" in created.find((r) => r.activityId === "ev-session")!, false, "an event entry gets no address of its own");
    assert.equal(parkRow.title, "Парк");
    assert.equal(created.find((r) => r.activityId === "ev-session")!.coverImageUrl, "c.jpg");
    assert.deepEqual(get().planItems.find((r) => r.id === "manual1"), manual, "a manual entry of the day is not touched");
    const scenario = get().dayScenarios[0]!;
    assert.equal(scenario.source, "ENGINE");
    assert.equal(scenario.lastSaveIdempotencyKey, "key-one-0001");
    assert.equal(typeof scenario.planFingerprint, "string");
    assert.notEqual(scenario.planFingerprint, "", "the editor's fingerprint matches the saved day");
    assert.deepEqual(scenario.legsJson, [{ planItemId: parkRow.id, mode: "car", minutes: 15, distanceM: 6000 }]);

    // idempotent replay: same key and request, nothing new
    const again = await saveDayScenarios("u1", request, "key-one-0001", deps(db));
    assert.deepEqual(again, response, "the stored answer is returned");
    assert.equal(get().planItems.length, 3, "no duplicates on replay");
    await assert.rejects(saveDayScenarios("u1", parse([{ date: SAT, items: [eventItem("ev-weekly", SAT, "08:00", "09:30")] }]), "key-one-0001", deps(db)), (e: unknown) => e instanceof DaySaveError && e.status === 409 && e.code === "IDEMPOTENCY_KEY_REUSED");
  }

  // ---- re-saving a day: its own entries are replaced, kept ones keep their id, manual entries stay
  {
    const manual = { id: "manual1", userId: "u1", date: SAT, activityId: null, placeId: null, title: "Бассейн", startsAt: new Date(at(SAT, "13:00")), scenarioId: null };
    const { db, get } = makeDb({ ...seedCatalog(), planItems: [manual] });
    const first = await saveDayScenarios("u1", parse([{ date: SAT, items: [eventItem("ev-session", SAT, "08:00", "09:30"), placeItem("pl-park", SAT, "10:30", "12:00")] }]), "key-first-001", deps(db));
    const keptId = first.days[0]!.items.find((i) => i.activityId === "ev-session")!.planItemId;
    const second = await saveDayScenarios("u1", parse([{ date: SAT, items: [eventItem("ev-session", SAT, "08:00", "09:30"), placeItem("pl-cafe", SAT, "15:00", "16:00")] }]), "key-second-02", deps(db));
    assert.equal(second.days[0]!.items.find((i) => i.activityId === "ev-session")!.planItemId, keptId, "a point that stays keeps its entry");
    const rows = get().planItems;
    assert.ok(!rows.some((r) => r.placeId === "pl-park"), "the dropped point is gone");
    assert.ok(rows.some((r) => r.placeId === "pl-cafe") && rows.some((r) => r.id === "manual1"));
    assert.equal(rows.length, 3);
  }

  // ---- «Изменить день»: a saved point the draft could not hold (keep) survives the re-save untouched
  {
    const { db, get } = makeDb(seedCatalog());
    const first = await saveDayScenarios("u1", parse([{ date: SAT, items: [eventItem("ev-session", SAT, "08:00", "09:30"), placeItem("pl-park", SAT, "10:30", "12:00")] }]), "key-keep-0001", deps(db));
    const parkId = first.days[0]!.items.find((i) => i.activityId === "pl-park")!.planItemId;
    const keepRequest = saveRequestSchema.parse({ days: [{ date: SAT, items: [eventItem("ev-session", SAT, "08:00", "09:30")], keep: [{ kind: "place", activityId: "pl-park" }] }] });
    await saveDayScenarios("u1", keepRequest, "key-keep-0002", deps(db));
    assert.ok(get().planItems.some((r) => r.id === parkId && r.placeId === "pl-park"), "the kept point is still in the plan, same entry");
    assert.equal(get().planItems.length, 2);
    assert.notEqual(requestHashOf(keepRequest), requestHashOf(parse([{ date: SAT, items: [eventItem("ev-session", SAT, "08:00", "09:30")] }])), "keep is part of the idempotency hash");
    await saveDayScenarios("u1", parse([{ date: SAT, items: [eventItem("ev-session", SAT, "08:00", "09:30")] }]), "key-keep-0003", deps(db));
    assert.ok(!get().planItems.some((r) => r.id === parkId), "without keep the dropped point is removed, as before");
  }

  // ---- a weekend: one transaction, one group, both scenarios
  {
    const { db, get } = makeDb(seedCatalog());
    const request = parse([{ date: SUN, items: [placeItem("pl-cafe", SUN, "09:00", "10:00")] }, { date: SAT, items: [eventItem("ev-session", SAT, "08:00", "09:30")] }]);
    const response = await saveDayScenarios("u1", request, "key-weekend-1", deps(db));
    assert.ok(response.groupId);
    assert.deepEqual(response.days.map((d) => d.date), [SAT, SUN], "days in date order");
    assert.ok(get().dayScenarios.length === 2 && get().dayScenarios.every((s) => s.groupId === response.groupId && s.source === "ENGINE"));
  }

  // ---- all or nothing: a clash on the second day leaves the first one unsaved too
  {
    const existing = { id: "own1", userId: "u1", date: "2026-12-01", activityId: "ev-weekly", placeId: null, title: "Уже в плане", startsAt: null, scenarioId: null };
    const { db, get } = makeDb({ ...seedCatalog(), planItems: [existing] });
    const request = parse([{ date: SAT, items: [eventItem("ev-session", SAT, "08:00", "09:30")] }, { date: SUN, items: [eventItem("ev-weekly", SUN, "08:00", "09:30")] }]);
    await assert.rejects(saveDayScenarios("u1", request, "key-clash-001", deps(db)), (e: unknown) => e instanceof DaySaveError && e.status === 409 && e.code === "DUPLICATE_ACTIVITY" && JSON.stringify(e.details) === JSON.stringify({ ids: ["ev-weekly"] }));
    assert.equal(get().planItems.length, 1, "nothing created");
    assert.deepEqual(get().planItems[0], existing, "the existing entry was not moved or edited");
    assert.equal(get().dayScenarios.length, 0, "no scenario rows left behind");
    const placeClash = { id: "own2", userId: "u1", date: "2026-12-02", activityId: null, placeId: "pl-park", title: "Парк", startsAt: null, scenarioId: null };
    const second = makeDb({ ...seedCatalog(), planItems: [placeClash] });
    await assert.rejects(saveDayScenarios("u1", parse([{ date: SAT, items: [placeItem("pl-park", SAT, "10:00", "11:30")] }]), "key-clash-002", deps(second.db)), (e: unknown) => e instanceof DaySaveError && e.code === "DUPLICATE_PLACE");
    assert.deepEqual(second.get().planItems, [placeClash]);
  }

  // ---- the family scope keeps its own OR: an entry the user cannot see is no clash (and its id is not disclosed)
  {
    const hidden = { id: "h1", userId: "other", visibility: "PRIVATE", date: "2026-12-03", activityId: "ev-session", placeId: null, scenarioId: null };
    const visible = { id: "h2", userId: "other", visibility: "FAMILY", date: "2026-12-03", activityId: "ev-weekly", placeId: null, scenarioId: null };
    const scoped = (db: NonNullable<SaveDeps["db"]>): SaveDeps => ({ ...deps(db), scopeFor: async (userId) => ({ OR: [{ userId }, { visibility: "FAMILY" }] }) });
    const first = makeDb({ ...seedCatalog(), planItems: [hidden] });
    await saveDayScenarios("u1", parse([{ date: SAT, items: [eventItem("ev-session", SAT, "08:00", "09:30")] }]), "key-acl-00001", scoped(first.db));
    const second = makeDb({ ...seedCatalog(), planItems: [hidden, visible] });
    await assert.rejects(
      saveDayScenarios("u1", parse([{ date: SAT, items: [eventItem("ev-session", SAT, "08:00", "09:30"), eventItem("ev-weekly", SAT, "08:00", "09:30")] }]), "key-acl-00002", scoped(second.db)),
      (e: unknown) => e instanceof DaySaveError && e.code === "DUPLICATE_ACTIVITY" && JSON.stringify(e.details) === JSON.stringify({ ids: ["ev-weekly"] }),
      "only the entry the user can see is reported",
    );
  }

  // ---- someone else's entry (not in the user's scope) is not a clash; unpublished or unknown points are refused
  {
    const { db } = makeDb({ ...seedCatalog(), planItems: [{ id: "x1", userId: "other", date: SAT, activityId: "ev-session", placeId: null, scenarioId: null }] });
    await saveDayScenarios("u1", parse([{ date: SAT, items: [eventItem("ev-session", SAT, "08:00", "09:30")] }]), "key-scope-001", deps(db));
    const refused = makeDb(seedCatalog());
    await assert.rejects(saveDayScenarios("u1", parse([{ date: SAT, items: [eventItem("ev-draft", SAT, "08:00", "09:30")] }]), "key-draft-001", deps(refused.db)), (e: unknown) => e instanceof DaySaveError && e.code === "INVALID_POINT");
    await assert.rejects(saveDayScenarios("u1", parse([{ date: SAT, items: [placeItem("pl-missing", SAT, "08:00", "09:30")] }]), "key-miss-0001", deps(refused.db)), (e: unknown) => e instanceof DaySaveError && e.code === "INVALID_POINT");
    await assert.rejects(saveDayScenarios("u1", parse([{ date: SAT, items: [eventItem("ev-nosession", SAT, "08:00", "09:30")] }]), "key-occur-001", deps(refused.db)), (e: unknown) => e instanceof DaySaveError && e.code === "INVALID_OCCURRENCE");
    await assert.rejects(saveDayScenarios("u1", parse([{ date: SAT, items: [eventItem("ev-withdrawn", SAT, "08:00", "09:30")] }]), "key-wdrwn-001", deps(refused.db)), (e: unknown) => e instanceof DaySaveError && e.code === "INVALID_OCCURRENCE");
    const multi = makeDb(seedCatalog());
    const savedMulti = await saveDayScenarios("u1", parse([{ date: SAT, items: [eventItem("ev-multi", SAT, "08:00", "09:30")] }]), "key-multi-001", deps(multi.db));
    assert.equal(savedMulti.days[0]!.items[0]!.timeType, "SUGGESTED", "a generated virtual occurrence of a MULTI_DATE event can be saved");
    assert.equal(refused.get().planItems.length, 0);
  }

  // ---- contracts: the route is behind the flag, needs sign-in and an idempotency key, and never moves entries
  {
    const route = readFileSync("src/app/api/plan/day-scenario/save/route.ts", "utf8");
    assert.match(route, /if \(!isDayScenarioEngineEnabled\(\)\) return NextResponse\.json\(\{ error: "Not found" \}, \{ status: 404 \}\);\s*try \{\s*const user = await getCurrentUser\(\);/, "404 before any work");
    assert.match(route, /UNAUTHENTICATED[\s\S]*401/);
    assert.match(route, /IDEMPOTENCY_KEY_REQUIRED/);
    assert.match(route, /checkRateLimit\(`day-scenario-save:\$\{user\.id\}`, 10, 60_000\)/);
    const draftSrc = readFileSync("src/server/services/dayScenarioEngine/draft.service.ts", "utf8");
    assert.match(draftSrc, /\{ OR: \[\{ scenarioId: null \}, \{ scenarioId: \{ not: editedScenario\.id \} \}\] \}/, "editing excludes only the edited scenario, not every scenario's entries");
    assert.match(draftSrc, /AND: \[\s*await activePlanScopeFor\(userId\)/, "the family scope's own OR stays intact");
    assert.match(draftSrc, /unpooledPinnedIds = request\.action === "rebuild"/, "pinned points the pool does not hold are reported");
    const service = readFileSync("src/server/services/dayScenarioEngine/save.service.ts", "utf8");
    assert.match(service, /where: \{ AND: \[scope, \{ OR: /, "the scope is combined with AND: a spread would replace the scope's own OR");
    assert.ok(!/plan\.service|\baddPlanItem\(|\baddPlacePlanItem\(/.test(service), "never the helpers that re-date an existing entry");
    assert.ok(/planItem\.deleteMany\(\{ where: \{ id: \{ in: [^}]*\} , scenarioId: row\.id \} \}\)|planItem\.deleteMany\(\{ where: \{ id: \{ in: [^}]*\}, scenarioId: row\.id \} \}\)/.test(service), "a delete is always scoped by the scenario's own id");
    const migration = readFileSync("prisma/migrations/20261108190000_day_scenario_save_fields/migration.sql", "utf8");
    assert.ok(!/\bDROP\b|DELETE FROM|^UPDATE /m.test(migration), "the migration is additive: nothing dropped, deleted or rewritten");
    assert.ok(/ADD COLUMN "pinned" BOOLEAN NOT NULL DEFAULT false/.test(migration) && /ON DELETE SET NULL/.test(migration));
  }

  console.log("day-scenario save tests passed");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
