import assert from "node:assert/strict";
import {
  buildClassScheduleInput,
  classScheduleInputSchema,
  defaultClassSchedule,
  getClassScheduleMissingFields,
  groupsFromRules,
  parseClassDurationMinutes,
  parseSeats,
} from "./offerClassSchedule";

// длительность из свободного текста
for (const [text, minutes] of [
  ["60 минут", 60],
  ["60 мин", 60],
  ["60", 60],
  ["45м", 45],
  ["1.5 часа", 90],
  ["1,5 ч", 90],
  ["2 часа", 120],
  ["1 ч 30 мин", 90],
  ["1ч30м", 90],
] as const) {
  assert.equal(parseClassDurationMinutes(text), minutes, text);
}
for (const text of ["", "около часа", "5 минут", "13 часов", "abc"]) {
  assert.equal(parseClassDurationMinutes(text), null, text);
}
assert.equal(parseSeats("8"), 8);
assert.equal(parseSeats(""), null);
assert.equal(parseSeats("0"), null);
assert.equal(parseSeats("2.5"), null);

// регулярные: группа без дней или с неверным временем отбрасывается; дни сортируются и не дублируются
const regular = defaultClassSchedule();
regular.groups = [
  { id: "a", days: [4, 2, 2], time: "17:30", seats: "8" },
  { id: "b", days: [], time: "10:00", seats: "5" },
  { id: "c", days: [6], time: "25:00", seats: "" },
];
regular.periodFrom = "2026-10-19";
regular.periodTo = "2026-12-14";
assert.deepEqual(buildClassScheduleInput(regular, ["2026-11-07", "2026-11-07", "bad"], "REGULAR_ACTIVITY", "1 час"), {
  kind: "recurring",
  durationMin: 60,
  groups: [{ days: [2, 4], time: "17:30", seats: 8 }],
  dates: [],
  period: { from: "2026-10-19", to: "2026-12-14" },
  closedDates: ["2026-11-07"],
});
assert.equal(buildClassScheduleInput(regular, [], "REGULAR_ACTIVITY", "около часа"), null);
assert.equal(buildClassScheduleInput(regular, [], "PLACE_VISIT", "60"), null);

// разовые: даты вместо групп, период не передаётся
const dated = defaultClassSchedule();
dated.dates = [
  { id: "d1", date: "2026-10-17", time: "12:00", seats: "10" },
  { id: "d2", date: "", time: "12:00", seats: "" },
];
const datedInput = buildClassScheduleInput(dated, [], "ONE_TIME_ACTIVITY", "90");
assert.equal(datedInput?.kind, "dated");
assert.deepEqual(datedInput?.dates, [{ date: "2026-10-17", time: "12:00", seats: 10 }]);
assert.equal(datedInput?.period, null);
assert.deepEqual(datedInput?.groups, []);

// чего не хватает
assert.deepEqual(getClassScheduleMissingFields(defaultClassSchedule(), "REGULAR_ACTIVITY", ""), [
  "Продолжительность занятия числом",
  "Дни и время занятий",
]);
assert.deepEqual(getClassScheduleMissingFields(defaultClassSchedule(), "ONE_TIME_ACTIVITY", "60"), ["Даты занятий"]);
assert.deepEqual(getClassScheduleMissingFields(regular, "REGULAR_ACTIVITY", "60"), []);
const late = defaultClassSchedule();
late.groups = [{ id: "x", days: [1], time: "23:30", seats: "" }];
assert.deepEqual(getClassScheduleMissingFields(late, "REGULAR_ACTIVITY", "60"), ["Занятие заканчивается после полуночи"]);
const reversed = { ...regular, periodFrom: "2026-12-14", periodTo: "2026-10-19" };
assert.ok(getClassScheduleMissingFields(reversed, "REGULAR_ACTIVITY", "60").includes("Даты курса"));
assert.deepEqual(getClassScheduleMissingFields(defaultClassSchedule(), "PLACE_VISIT", ""), []);

// схема запроса: занятие не должно выходить за полночь, конец курса не раньше начала
assert.equal(
  classScheduleInputSchema.safeParse({ kind: "recurring", durationMin: 60, groups: [{ days: [1], time: "23:30", seats: null }] }).success,
  false,
);
assert.equal(
  classScheduleInputSchema.safeParse({
    kind: "recurring",
    durationMin: 60,
    groups: [{ days: [1], time: "10:00", seats: null }],
    period: { from: "2026-12-01", to: "2026-11-01" },
  }).success,
  false,
);
assert.equal(
  classScheduleInputSchema.safeParse({ kind: "recurring", durationMin: 60, groups: [{ days: [8], time: "10:00", seats: null }] }).success,
  false,
);
assert.equal(classScheduleInputSchema.safeParse({ kind: "dated", durationMin: 60 }).success, true);

// правила БД → группы формы
const restored = groupsFromRules([
  { weekday: 2, startMinutes: 1050, capacity: 8, validFrom: new Date("2026-10-19T00:00:00Z"), validTo: new Date("2026-12-14T00:00:00Z") },
  { weekday: 4, startMinutes: 1050, capacity: 8, validFrom: new Date("2026-10-19T00:00:00Z"), validTo: new Date("2026-12-14T00:00:00Z") },
  { weekday: 6, startMinutes: 660, capacity: null, validFrom: new Date("2026-10-19T00:00:00Z"), validTo: new Date("2026-12-14T00:00:00Z") },
]);
assert.equal(restored.groups.length, 2);
assert.deepEqual(restored.groups.map((group) => [group.days, group.time, group.seats]), [
  [[6], "11:00", ""],
  [[2, 4], "17:30", "8"],
]);
assert.equal(restored.periodFrom, "2026-10-19");
assert.equal(restored.periodTo, "2026-12-14");
assert.deepEqual(groupsFromRules([]).groups, []);

console.log("offerClassSchedule.test.ts: ok");
