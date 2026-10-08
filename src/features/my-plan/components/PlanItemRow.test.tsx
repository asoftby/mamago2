import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { PlanItemRow, planItemVisualKind } from "./PlanItemRow";
import type { PlanItemWithActivity } from "../types/event";

function item(id: string, title = `Item ${id}`): PlanItemWithActivity {
  return {
    id,
    userId: "user",
    activityId: null,
    date: "2026-09-01",
    startsAt: null,
    title,
    coverImageUrl: null,
    createdAt: new Date("2026-08-01"),
    activity: null,
  };
}

assert.equal(planItemVisualKind({ source: "CATALOG" }), "event");
assert.equal(planItemVisualKind({ source: "MANUAL" }), "note");
assert.equal(planItemVisualKind({ source: "TELEGRAM_FORWARD" }), "note");
assert.equal(planItemVisualKind({ source: undefined }), "event");

const longTitle = "Очень длинный заголовок события для проверки двух строк";

const restingHtml = renderToStaticMarkup(
  <PlanItemRow item={item("one", longTitle)} onRemove={() => undefined} />,
);

// Без времени → «Весь день»; без ребёнка → «Вся семья»; без напоминания → колокольчика нет.
assert.match(restingHtml, /Весь день/);
assert.match(restingHtml, /Вся семья/);
assert.doesNotMatch(restingHtml, /за 1 ч/);

// Карточка: один «⋮», без шеврона и плашек «Заметка» / «Из mamaGo».
assert.match(restingHtml, /aria-label="Действия: «/);
assert.doesNotMatch(restingHtml, /Из mamaGo/);
assert.doesNotMatch(restingHtml, />Заметка</);

const timedHtml = renderToStaticMarkup(
  <PlanItemRow
    item={{
      ...item("two", "Врач"),
      source: "MANUAL",
      startsAt: new Date("2026-09-01T07:30:00"),
      reminderEnabled: true,
    }}
    participantLabel="Тая"
    onRemove={() => undefined}
  />,
);
assert.match(timedHtml, /07:30/);
assert.match(timedHtml, />Тая</);
assert.match(timedHtml, /за 1 ч/);
assert.match(timedHtml, /aria-label="Значок: Здоровье\. Изменить"/, "ручной пункт: категория из названия, иконку можно сменить");

const rowSource = readFileSync(new URL("./PlanItemRow.tsx", import.meta.url), "utf8");
assert.doesNotMatch(rowSource, /onTouchStart=/, "mobile row must not use swipe-to-delete");
assert.doesNotMatch(rowSource, /onTouchMove=/, "mobile row must not use swipe-to-delete");
assert.doesNotMatch(rowSource, /longPressTimerRef/, "mobile row must not use long-press delete");
assert.match(rowSource, /WebkitLineClamp: 2/, "titles must render up to two lines");
assert.match(rowSource, /items-start/, "columns are top-aligned so cards of different height do not jump");

console.log("PlanItemRow redesigned record-card tests: OK");
