import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StatisticsRangeCalendar } from "./StatisticsRangeCalendar";

const markup = renderToStaticMarkup(<StatisticsRangeCalendar min="2026-09-10" max="2026-10-14"
  from="2026-09-10" to="2026-10-14" onApply={() => {}} onCancel={() => {}} />);
function day(key: string) {
  const tag = markup.match(new RegExp(`<button[^>]*aria-label="${key}"[^>]*>`))?.[0];
  assert.ok(tag, `Expected date ${key}`);
  return tag;
}
assert.match(day("2026-09-09"), / disabled=""/);
assert.doesNotMatch(day("2026-09-10"), / disabled=""/);
assert.doesNotMatch(day("2026-10-14"), / disabled=""/);
assert.match(day("2026-10-15"), / disabled=""/);
assert.match(day("2026-09-10"), /aria-pressed="true"/);
assert.match(day("2026-09-20"), /aria-pressed="true"/);
assert.match(markup, /Отмена/);
assert.match(markup, /Применить/);
console.log("StatisticsRangeCalendar.test: OK");
