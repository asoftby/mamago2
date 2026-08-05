import assert from "node:assert/strict";
import test from "node:test";
import type { PlanItemWithActivity } from "../types/event";
import { MY_PLAN_FULL_PAGE_HREF, selectUpcomingPlanItems, upcomingPlanItemHref } from "./upcomingPlanItems";

function item(id: string, date: string): PlanItemWithActivity {
  return {
    id,
    userId: "user",
    activityId: id,
    date,
    startsAt: null,
    title: `Item ${id}`,
    coverImageUrl: null,
    createdAt: new Date("2026-08-01"),
    activity: null,
  };
}

const base = {
  selectedDate: "2026-08-05",
  todayIso: "2026-08-05",
  selectedDateItems: [] as PlanItemWithActivity[],
  nearestDate: null as string | null,
  nearestCount: 0,
  nearestItems: [] as PlanItemWithActivity[],
};

test("нет активностей — блок скрыт", () => {
  assert.equal(selectUpcomingPlanItems(base), null);
});

test("одна ближайшая активность отображается", () => {
  const next = item("1", "2026-08-06");
  assert.deepEqual(selectUpcomingPlanItems({ ...base, nearestDate: next.date, nearestCount: 1, nearestItems: [next] }), {
    date: next.date, count: 1, items: [next],
  });
});

test("несколько активностей выбранной даты имеют приоритет", () => {
  const selected = [item("1", base.selectedDate), item("2", base.selectedDate)];
  const result = selectUpcomingPlanItems({ ...base, selectedDateItems: selected, nearestDate: "2026-08-06", nearestCount: 1, nearestItems: [item("3", "2026-08-06")] });
  assert.equal(result?.count, 2);
  assert.deepEqual(result?.items, selected);
});

test("больше двух активностей ограничиваются двумя, общий счётчик сохраняется", () => {
  const selected = [item("1", base.selectedDate), item("2", base.selectedDate), item("3", base.selectedDate)];
  const result = selectUpcomingPlanItems({ ...base, selectedDateItems: selected });
  assert.equal(result?.count, 3);
  assert.deepEqual(result?.items.map((value) => value.id), ["1", "2"]);
});

test("пустая выбранная дата показывает ближайшую будущую", () => {
  const nearest = [item("1", "2026-08-08"), item("2", "2026-08-08")];
  const result = selectUpcomingPlanItems({ ...base, selectedDate: "2026-08-07", nearestDate: "2026-08-08", nearestCount: 4, nearestItems: nearest });
  assert.equal(result?.date, "2026-08-08");
  assert.equal(result?.count, 4);
});

test("прошедшие активности не отображаются", () => {
  assert.equal(selectUpcomingPlanItems({ ...base, selectedDate: "2026-08-04", selectedDateItems: [item("old", "2026-08-04")] }), null);
});

test("уже начавшаяся сегодня активность не отображается", () => {
  const past = { ...item("past", base.todayIso), startsAt: new Date("2026-08-05T10:00:00Z") };
  assert.equal(selectUpcomingPlanItems({ ...base, selectedDateItems: [past], now: new Date("2026-08-05T12:00:00Z") }), null);
});

test("быстрый переход ведёт на существующий экран маршрута", () => {
  assert.equal(upcomingPlanItemHref({ ...item("route", base.selectedDate), activityId: null, planRouteSlug: "family-day" }), "/routes/family-day");
});

test("переход ко всему плану использует полноценный раздел", () => {
  assert.equal(MY_PLAN_FULL_PAGE_HREF, "/me/plan");
});
