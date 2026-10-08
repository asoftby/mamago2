import assert from "node:assert/strict";
import { buildPlanCapsuleModel, type PlanCapsuleItem } from "./planCapsule";

const today = "2026-10-08"; // чт
const now = new Date("2026-10-08T10:00:00");
const at = (date: string, hhmm: string | null, title = "Событие"): PlanCapsuleItem => ({
  date,
  startsAt: hhmm ? new Date(`${date}T${hhmm}:00`) : null,
  title,
});
const build = (nearestItems: PlanCapsuleItem[], countsByDate: Record<string, number>) =>
  buildPlanCapsuleModel({ nearestItems, countsByDate, todayIso: today, now });

// Пусто
assert.deepEqual(build([], {}), { kind: "empty", ariaLabel: "Мой план пуст" });

// Одно событие сегодня
let m = build([at(today, "18:30", "Смешанные чувства")], { [today]: 1 });
assert.equal(m.kind, "events");
if (m.kind === "events") {
  assert.equal(m.caption, "Сегодня · 18:30");
  assert.equal(m.title, "Смешанные чувства");
  assert.deepEqual(m.bubble, { weekday: "чт", day: 8 });
  assert.equal(m.stackedNext, null);
  assert.equal(m.badgeCount, null);
  assert.equal(m.ariaLabel, "Мой план: Смешанные чувства, сегодня в 18:30");
}

// Завтра / день недели / далеко
m = build([at("2026-10-09", "11:00")], { "2026-10-09": 1 });
assert.equal(m.kind === "events" && m.caption, "Завтра · 11:00");
m = build([at("2026-10-10", "11:30")], { "2026-10-10": 1 });
assert.equal(m.kind === "events" && m.caption, "Сб · 11:30");
m = build([at("2026-10-20", "11:30")], { "2026-10-20": 1 });
assert.equal(m.kind === "events" && m.caption, "Через 12 дней");
assert.equal(m.kind === "events" && m.ariaLabel, "Мой план: Событие, 20 октября в 11:30");

// Несколько в разные дни → стопка и «ещё N»
m = build([at(today, "18:30")], { [today]: 1, "2026-10-10": 1, "2026-10-12": 2 });
if (m.kind === "events") {
  assert.equal(m.caption, "Сегодня 18:30 · ещё 3");
  assert.deepEqual(m.stackedNext, { weekday: "сб", day: 10 });
}
m = build([at(today, "18:30")], { [today]: 1, "2026-10-10": 20 });
assert.equal(m.kind === "events" && m.caption, "Сегодня 18:30 · ещё 9+");

// Несколько сегодня → бейдж
m = build([at(today, "11:30", "Киберкласс"), at(today, "15:00")], { [today]: 3 });
if (m.kind === "events") {
  assert.equal(m.caption, "Сегодня · 3 события");
  assert.equal(m.title, "11:30 Киберкласс");
  assert.equal(m.badgeCount, 3);
  assert.equal(m.stackedNext, null);
}

// Прошедшее сегодня исключается
m = build([at(today, "09:00", "Прошло"), at(today, "14:00", "Будет")], { [today]: 1 });
assert.equal(m.kind === "events" && m.title, "Будет");
m = build([at(today, "09:00", "Прошло")], { [today]: 0 });
assert.equal(m.kind, "empty");

// Пункт без времени
m = build([at("2026-10-09", null, "Весь день")], { "2026-10-09": 1 });
assert.equal(m.kind === "events" && m.caption, "Завтра");

console.log("planCapsule.test ok");
