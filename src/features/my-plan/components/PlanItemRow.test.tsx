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

const restingHtml = renderToStaticMarkup(
  <PlanItemRow item={item("one", "Очень длинный заголовок события для проверки двух строк")} onRemove={() => undefined} />,
);

const removeButton = restingHtml.match(/<button[^>]*aria-label="Убрать[^"]*из плана"[^>]*>/);
assert.ok(removeButton, "explicit remove button must be rendered");
assert.match(removeButton![0], /opacity-100/);
assert.match(removeButton![0], /md:opacity-0/);

const rowSource = readFileSync(new URL("./PlanItemRow.tsx", import.meta.url), "utf8");
assert.doesNotMatch(rowSource, /onTouchStart=/, "mobile row must not use swipe-to-delete");
assert.doesNotMatch(rowSource, /onTouchMove=/, "mobile row must not use swipe-to-delete");
assert.doesNotMatch(rowSource, /longPressTimerRef/, "mobile row must not use long-press delete");
assert.match(rowSource, /WebkitLineClamp: 2/, "titles must render up to two lines");

console.log("PlanItemRow explicit-delete + two-line-title tests: OK");
