import assert from "node:assert/strict";
import { MOCK_EVENTS } from "../ops/day-scenario-mocks/events.data";
import { MOCK_PLACES } from "../ops/day-scenario-mocks/places.data";
import { resolveSlotDates, sessionInstant } from "../ops/seed-day-scenario-mocks";
import { checkResult, oracleAgeRanges, PLAN_FIXTURE_TITLE, renderReport, seededAvailability, specFor, totalsOf, type ApiItem, type ApiResult, type RunParams } from "./day-scenario-matrix.lib";
import { hoursPlanFor } from "../ops/seed-day-scenario-mocks";

const dates = resolveSlotDates("2026-11-07");
const run = (over: Partial<RunParams> = {}): RunParams => ({ id: "T", date: dates.sat1, dateLabel: "sat", mode: "car", audience: "t", ageRanges: [], toddler: false, window: { start: "09:00", end: "20:00" }, planItem: false, ...over });
const item = (title: string, start: string, end: string, travel: ApiItem["travel"] = null, over: Partial<ApiItem> = {}): ApiItem =>
  ({ activityId: title, card: { title }, startsAt: sessionInstant(dates.sat1, start).toISOString(), endsAt: sessionInstant(dates.sat1, end).toISOString(), travel, approximatePlace: false, far: false, ...over });
const result = (items: ApiItem[], status = "ok"): ApiResult => ({ status, mode: "car", suggestMode: null, items });
const rules = (r: RunParams, items: ApiItem[], prior: string[] = []) => checkResult(r, "step", result(items), { dates, priorSignatures: prior }).map((v) => v.rule);

// ---- oracle ages for authenticated audiences come from birth data, never empty
const kids = [{ birthDate: "2019-03-10T00:00:00.000Z", birthPrecision: "DAY" as const }, { birthDate: "2014-06-01T00:00:00.000Z", birthPrecision: "DAY" as const }];
const kidRanges = oracleAgeRanges(kids, dates.sat1);
assert.equal(kidRanges.length, 2, `two children, two ranges: ${kidRanges.join(",")}`);
assert.throws(() => oracleAgeRanges([{ birthDate: null }], dates.sat1), /cannot derive age ranges/);
assert.throws(() => oracleAgeRanges([], dates.sat1), /cannot derive age ranges/);
{
  const adultsPlace = MOCK_PLACES.find((x) => x.adultOnly)!;
  const authedRun = run({ audience: "user 7+12", ageRanges: kidRanges });
  assert.ok(rules(authedRun, [item(adultsPlace.title, "10:00", "11:30")]).includes("Возраст: место 18+ в детском сценарии"), "age checks apply to authenticated audiences once ranges are derived");
}
assert.equal(PLAN_FIXTURE_TITLE, "[MOCK] Запись плана 12:00");

// ---- spec lookup: places and events resolve to coordinates and a geoCell5
const p = MOCK_PLACES.find((x) => x.key === "center-park-1")!;
assert.equal(specFor(p.title)?.kind, "place");
assert.ok(specFor(p.title)?.geoCell5);
const ev = MOCK_EVENTS.find((e) => e.key === "c-draw")!;
assert.equal(specFor(ev.title)?.kind, "event");
assert.equal(specFor(ev.title)?.lat, MOCK_PLACES.find((x) => x.key === ev.placeKey)!.lat, "events inherit their venue's coordinates");
assert.equal(specFor("[MOCK] Событие: место без координат")?.lat, null);
assert.equal(specFor("unknown"), null);

// ---- hours oracle
const byVariant = (v: string) => MOCK_PLACES.findIndex((x) => x.hours === v);
const plan = (v: string, ordinal = byVariant(v)) => hoursPlanFor(MOCK_PLACES[ordinal]!, dates, ordinal);
assert.equal(seededAvailability(plan("always"), dates.sat1), "always");
assert.equal(seededAvailability(plan("none"), dates.sat1), "unknown");
assert.equal(seededAvailability(plan("appointment"), dates.sat1), "closed");
assert.equal(seededAvailability(plan("temp-closed"), dates.sat1), "closed");
assert.equal(seededAvailability(plan("monday-off"), "2026-11-09"), "closed", "2026-11-09 is a Monday");
const weekendWin = seededAvailability(plan("weekly"), dates.sat1) as { startMs: number; endMs: number }[];
assert.deepEqual([weekendWin[0]!.startMs, weekendWin[0]!.endMs], [sessionInstant(dates.sat1, "11:00").getTime(), sessionInstant(dates.sat1, "20:00").getTime()]);
const weekdayWin = seededAvailability(plan("weekly"), dates.wed1) as { startMs: number; endMs: number }[];
assert.equal(weekdayWin[0]!.endMs, sessionInstant(dates.wed1, "19:00").getTime());

// ---- totals
const t = totalsOf([item(p.title, "10:00", "11:30"), item(MOCK_PLACES.find((x) => x.cluster === "kamgorka")!.title, "13:00", "14:30", { mode: "car", minutes: 30, distanceM: 12000 })]);
assert.deepEqual(t, { points: 2, km: 12, travelMin: 30, cell5Transitions: 1 });

// ---- violations
const park = MOCK_PLACES.find((x) => x.key === "center-park-1")!;
const park2 = MOCK_PLACES.find((x) => x.key === "center-park-2")!;
assert.deepEqual(rules(run(), [item(park.title, "12:30", "14:00")]), [], "a clean single-point scenario has no violations");
assert.ok(rules(run({ mode: "walk" }), [item(park.title, "12:30", "14:00"), item(park2.title, "15:00", "16:30", { mode: "walk", minutes: 20, distanceM: 1500 })]).includes("Пеший переход > 15 мин"));
assert.ok(rules(run({ mode: "walk", toddler: true }), [item(park.title, "12:30", "14:00"), item(park2.title, "15:00", "16:30", { mode: "walk", minutes: 12, distanceM: 2400 })]).includes("Сумма пешком > лимита"));
assert.equal(rules(run({ mode: "walk" }), [item(park.title, "12:30", "14:00"), item(park2.title, "15:00", "16:30", { mode: "walk", minutes: 12, distanceM: 2400 })]).includes("Сумма пешком > лимита"), false, "2.4 km is within the 3 km adult limit");
const far = MOCK_PLACES.filter((x) => x.cluster === "kamgorka" || x.cluster === "uruche" || x.cluster === "center");
assert.ok(rules(run(), [item(far.find((x) => x.cluster === "center")!.title, "10:00", "11:30"), item(far.find((x) => x.cluster === "kamgorka")!.title, "13:00", "14:30", { mode: "car", minutes: 25, distanceM: 9000 }), item(far.find((x) => x.cluster === "uruche")!.title, "16:00", "17:30", { mode: "car", minutes: 40, distanceM: 16000 })]).includes("Больше одного дальнего переезда (geoCell5)"));
assert.ok(rules(run({ window: { start: "16:00", end: "20:00" } }), [item(park.title, "15:00", "16:30")]).includes("Точка вне окна дня"));
assert.ok(rules(run({ planItem: true }), [item(park.title, "12:30", "14:00")]).includes("Пересечение с записью плана (12:00–13:30)"));
assert.equal(rules(run({ planItem: true }), [item(park.title, "13:30", "15:00")]).includes("Пересечение с записью плана (12:00–13:30)"), false, "touching the plan entry is not an overlap");
const appt = MOCK_PLACES.find((x) => x.hours === "appointment")!;
assert.ok(rules(run(), [item(appt.title, "12:00", "13:30")]).includes("Точка в закрытое время"));
assert.ok(rules(run(), [item(park.title, "09:30", "11:00")]).includes("Точка в закрытое время"), "before 11:00 on a Saturday");
assert.ok(rules(run(), [item(park.title, "10:00", "11:30"), item(park2.title, "11:00", "12:30")]).includes("Пересечение точек"));
assert.ok(rules(run({ ageRanges: ["0-1", "1-3"] }), [item(MOCK_PLACES.find((x) => x.adultOnly)!.title, "12:00", "13:30")]).includes("Возраст: место 18+ в детском сценарии"));
assert.ok(rules(run({ ageRanges: ["0-1"] }), [item(MOCK_PLACES.find((x) => x.ages.includes("12-14"))!.title, "12:00", "13:30")]).includes("Возраст: нет пересечения диапазонов"));
const one = [item(park.title, "12:30", "14:00")];
assert.ok(rules(run(), one, [one.map((i) => `${i.activityId}@${i.startsAt}`).join("|")]).includes("Повтор варианта"));
assert.ok(rules(run(), [item(park.title, "10:00", "11:30"), { ...item(park.title, "13:00", "14:30") }]).includes("Повтор точки внутри сценария"));

// ---- report renders, escapes and lists violations
const html = renderReport({
  generatedAt: "2026-11-07T00:00:00Z", base: "https://dev.example", build: "dev-1 (abc)", dates, calls: 3, notes: ["note <b>"],
  runs: [{ params: run(), steps: [{ name: "Собрать", httpStatus: 200, ms: 12, result: result([item(park.title, "12:30", "14:00"), item(appt.title, "15:00", "16:30", { mode: "car", minutes: 10, distanceM: 3000 }, { hoursUnconfirmed: true })]), violations: [{ run: "T", step: "Собрать", rule: "Точка в закрытое время", detail: "x" }] }] }],
});
assert.ok(html.includes("<!doctype html>") && html.includes("Нарушения (1)") && html.includes("уточните часы работы"));
assert.ok(html.includes("note &lt;b&gt;") && !html.includes("note <b>"), "text is escaped");
assert.ok(html.includes("geoCell5"), "timeline shows the geoCell5 column");

console.log("day-scenario matrix tests passed");
