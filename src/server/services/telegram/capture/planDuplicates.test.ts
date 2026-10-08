import assert from "node:assert/strict";
import test from "node:test";
import { entry } from "./captureDraft.testkit";
import { CaptureDraftSchema, type CaptureEntry } from "./captureDraft.schema";
import {
  findPlanDuplicates,
  scoreDuplicateCandidates,
  titleSimilarity,
  TITLE_SIMILARITY_THRESHOLD,
  type DuplicateCandidate,
} from "./planDuplicates";

const TZ = "Europe/Minsk";
const parse = (over: Record<string, unknown> = {}): CaptureEntry =>
  CaptureDraftSchema.parse({ intent: "CREATE", entries: [entry(over)], match: { candidatePlanItemId: null, changes: [] } })
    .entries[0]!;

function candidate(over: Partial<DuplicateCandidate> = {}): DuplicateCandidate {
  return {
    id: "item-1",
    source: "TELEGRAM_FORWARD",
    title: "Экскурсия в музей",
    childId: null,
    startsAt: new Date("2026-10-09T06:30:00Z"), // 09:30 Minsk
    dueAt: null,
    date: "2026-10-09",
    ...over,
  };
}

const event = (over: Record<string, unknown> = {}) =>
  parse({ startsAt: { value: "2026-10-09T09:30:00+03:00", state: "stated", basis: null }, ...over });

test("title similarity: order-independent, case/punctuation/ё-insensitive, stop words ignored", () => {
  assert.equal(titleSimilarity("Экскурсия в музей", "музей: экскурсия!"), 1);
  assert.equal(titleSimilarity("ЭКСКУРСИЯ В МУЗЕЙ", "экскурсия на музей"), 1);
  assert.equal(titleSimilarity("Ёлка для детей", "елка детей"), 1);
  assert.equal(titleSimilarity("", "музей"), 0);
  assert.equal(titleSimilarity("в на", "в на"), 0);
});

// Calibration fixtures: [a, b, shouldBeDuplicate]
const TITLE_FIXTURES: Array<[string, string, boolean]> = [
  ["Экскурсия в музей", "Экскурсия в музей истории", true],
  ["Экскурсия в музей", "экскурсии в музее", true],
  ["Школьная поездка в Мир", "Поездка в Мир (школьная)", true],
  ["Занятие по рисованию", "Рисование", true],
  ["Футбол", "футбол!", true],
  ["Родительское собрание 5Б", "Собрание родительское 5Б", true],
  ["Бассейн", "Плавание в бассейне", true],
  ["Экскурсия в музей истории", "Поездка в музей игрушки", false],
  ["Экскурсия в музей", "Поездка в музей", false],
  ["Родительское собрание", "Родительский чат", false],
  ["Английский язык", "Английский клуб", false],
  ["Сдать деньги на экскурсию", "Экскурсия в музей", false],
  ["Танцы", "Рисование", false],
  ["Утренник 1Б", "Утренник 2А", false],
];

test("calibration: the threshold separates duplicate pairs from look-alikes on fixtures", () => {
  for (const [a, b, expected] of TITLE_FIXTURES) {
    const score = titleSimilarity(a, b);
    assert.equal(score >= TITLE_SIMILARITY_THRESHOLD, expected, `${a} / ${b} -> ${score.toFixed(2)}`);
  }
});

test("EVENT: same title within ±60 minutes is a duplicate; outside the window is not", () => {
  const inside = scoreDuplicateCandidates(event(), [candidate({ startsAt: new Date("2026-10-09T07:20:00Z") })], TZ);
  assert.equal(inside.length, 1);
  assert.equal(inside[0]!.planItemId, "item-1");
  const edge = scoreDuplicateCandidates(event(), [candidate({ startsAt: new Date("2026-10-09T07:30:00Z") })], TZ);
  assert.equal(edge.length, 1, "exactly 60 minutes is inside");
  const outside = scoreDuplicateCandidates(event(), [candidate({ startsAt: new Date("2026-10-09T07:31:00Z") })], TZ);
  assert.equal(outside.length, 0);
});

test("EVENT: a candidate without a time matches on the same local date only", () => {
  const sameDay = scoreDuplicateCandidates(event(), [candidate({ startsAt: null, date: "2026-10-09" })], TZ);
  assert.equal(sameDay.length, 1);
  const otherDay = scoreDuplicateCandidates(event(), [candidate({ startsAt: null, date: "2026-10-10" })], TZ);
  assert.equal(otherDay.length, 0);
  const nullDate = scoreDuplicateCandidates(event(), [candidate({ startsAt: null, date: null })], TZ);
  assert.equal(nullDate.length, 0, "a null date (nullable PlanItem.date) must not crash or match");
});

test("local date is computed in the owner's time zone", () => {
  // 21:30 UTC on Oct 8 is 00:30 on Oct 9 in Minsk.
  const lateNight = event({ startsAt: { value: "2026-10-09T00:30:00+03:00", state: "stated", basis: null } });
  const hit = scoreDuplicateCandidates(lateNight, [candidate({ startsAt: null, date: "2026-10-09" })], "Europe/Minsk");
  assert.equal(hit.length, 1);
  const miss = scoreDuplicateCandidates(lateNight, [candidate({ startsAt: null, date: "2026-10-09" })], "America/New_York");
  assert.equal(miss.length, 0);
});

test("TASK: same local day by dueAt matches; another day does not", () => {
  const task = parse({
    entryType: "TASK",
    title: { value: "Сдать деньги на экскурсию", state: "stated" },
    startsAt: { value: null, state: "missing", basis: null },
    dueAt: { value: "2026-10-07T00:00:00+03:00", hasTime: false, state: "stated" },
  });
  const sameDay = candidate({ title: "Сдать деньги на экскурсию", startsAt: null, dueAt: new Date("2026-10-06T21:00:00Z"), date: "2026-10-07" });
  assert.equal(scoreDuplicateCandidates(task, [sameDay], TZ).length, 1);
  const otherDay = candidate({ title: "Сдать деньги на экскурсию", startsAt: null, dueAt: new Date("2026-10-08T21:00:00Z"), date: "2026-10-09" });
  assert.equal(scoreDuplicateCandidates(task, [otherDay], TZ).length, 0);
});

test("child compatibility: same child, one side null match; different children do not", () => {
  const withChild = event({ child: { childId: "c1", raw: "Тая", state: "stated" } });
  assert.equal(scoreDuplicateCandidates(withChild, [candidate({ childId: "c1" })], TZ).length, 1);
  assert.equal(scoreDuplicateCandidates(withChild, [candidate({ childId: null })], TZ).length, 1);
  assert.equal(scoreDuplicateCandidates(event(), [candidate({ childId: "c2" })], TZ).length, 1, "draft child null");
  assert.equal(scoreDuplicateCandidates(withChild, [candidate({ childId: "c2" })], TZ).length, 0);
});

test("false positives: similar time but different thing, or same title far away in time", () => {
  assert.equal(scoreDuplicateCandidates(event(), [candidate({ title: "Бассейн" })], TZ).length, 0);
  assert.equal(scoreDuplicateCandidates(event(), [candidate({ title: "Родительское собрание" })], TZ).length, 0);
  assert.equal(scoreDuplicateCandidates(event(), [candidate({ startsAt: new Date("2026-10-16T06:30:00Z") })], TZ).length, 0);
});

test("catalogue items count as duplicates too (any source)", () => {
  const catalog = candidate({ source: "CATALOG", title: "Экскурсия в музей истории" });
  const result = scoreDuplicateCandidates(event(), [catalog], TZ);
  assert.equal(result[0]!.source, "CATALOG");
});

test("entries without any date or title are never matched", () => {
  const noDate = parse({ startsAt: { value: null, state: "missing", basis: null } });
  assert.deepEqual(scoreDuplicateCandidates(noDate, [candidate()], TZ), []);
  const noTitle = event({ title: { value: "  ", state: "missing" } });
  assert.deepEqual(scoreDuplicateCandidates(noTitle, [candidate()], TZ), []);
});

test("results are sorted by similarity", () => {
  const result = scoreDuplicateCandidates(
    event(),
    [candidate({ id: "weaker", title: "Экскурсия в музей истории и театра" }), candidate({ id: "exact" })],
    TZ,
  );
  assert.equal(result[0]!.planItemId, "exact");
});

test("findPlanDuplicates queries the owner's non-cancelled items of any source and returns scored matches", async () => {
  let where: unknown;
  const db = {
    planItem: {
      findMany: async (args: { where: unknown }) => {
        where = args.where;
        return [
          { id: "catalog-1", source: "CATALOG", title: null, childId: null, startsAt: new Date("2026-10-09T06:45:00Z"), dueAt: null, date: "2026-10-09", activity: { title: "Экскурсия в музей" } },
          { id: "other", source: "TELEGRAM_FORWARD", title: "Бассейн", childId: null, startsAt: new Date("2026-10-09T06:30:00Z"), dueAt: null, date: "2026-10-09", activity: null },
        ];
      },
    },
  };
  const matches = await findPlanDuplicates({ db: db as never }, { userId: "owner-1" }, event(), TZ);
  assert.deepEqual(matches.map((m) => [m.planItemId, m.source]), [["catalog-1", "CATALOG"]]);
  const w = where as { userId: string; cancelledAt: null; source?: unknown };
  assert.equal(w.userId, "owner-1");
  assert.equal(w.cancelledAt, null);
  assert.equal(w.source, undefined, "no source filter: catalogue items are included");

  const none = await findPlanDuplicates({ db: db as never }, { userId: "owner-1" }, parse({ startsAt: { value: null, state: "missing", basis: null } }), TZ);
  assert.deepEqual(none, []);
});
