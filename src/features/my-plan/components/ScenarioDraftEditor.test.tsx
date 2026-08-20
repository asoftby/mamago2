import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { ScenarioConflictCard, ScenarioUndoStatus, formatScenarioTimeRange } from "./ScenarioDraftEditor";
import type { ScenarioClientItem } from "@/features/my-plan/lib/scenarioDraft";

function item(planItemId: string, title: string, startsAt: string, endsAt: string): ScenarioClientItem {
  return {
    planItemId,
    activityId: `activity-${planItemId}`,
    activitySessionId: null,
    title,
    coverImageUrl: null,
    href: null,
    startsAt,
    endsAt,
    durationMinutes: 60,
    schedulingKind: "SLOT",
    canReschedule: false,
  };
}

const firstPair = [
  item("one", "Спектакль", "2026-08-22T05:00:00.000Z", "2026-08-22T07:00:00.000Z"),
  item("two", "Мастер-класс", "2026-08-22T05:30:00.000Z", "2026-08-22T06:30:00.000Z"),
];
const secondPair = [
  item("three", "Экскурсия", "2026-08-22T10:00:00.000Z", "2026-08-22T11:00:00.000Z"),
  item("four", "Занятие", "2026-08-22T10:15:00.000Z", "2026-08-22T11:15:00.000Z"),
];

const noop = () => undefined;
const html = renderToStaticMarkup(
  <>
    <ScenarioConflictCard conflictKey="one:two" items={firstPair} onReplace={noop} onRemove={noop} onKeep={noop} />
    <ScenarioConflictCard conflictKey="three:four" items={secondPair} onReplace={noop} onRemove={noop} onKeep={noop} />
  </>,
);

assert.equal(formatScenarioTimeRange(firstPair[0]), "08:00–10:00");
assert.match(html, />08:00–10:00</);
assert.match(html, />08:30–09:30</);
assert.match(html, />Спектакль</);
assert.match(html, />Мастер-класс</);
assert.match(html, /aria-label="Заменить: Спектакль"/);
assert.match(html, /aria-label="Удалить: Мастер-класс"/);
assert.match(html, /aria-label="Оставить оба: Спектакль и Мастер-класс"/);
assert.equal((html.match(/⚠ Время пересекается/g) ?? []).length, 2);
assert.equal((html.match(/>Оставить оба</g) ?? []).length, 2);

const undoHtml = renderToStaticMarkup(
  <>
    <ScenarioUndoStatus label="Заменено" targetTitle="Спектакль" onUndo={noop} />
    <ScenarioUndoStatus label="Удалено из черновика" targetTitle="Мастер-класс" onUndo={noop} />
    <ScenarioUndoStatus label="Оставлены оба" targetTitle="конфликтная пара" actionLabel="Отменить" onUndo={noop} />
  </>,
);
assert.match(undoHtml, /Заменено/);
assert.match(undoHtml, /Удалено из черновика/);
assert.match(undoHtml, /Оставлены оба/);
assert.match(undoHtml, /aria-label="Вернуть: Спектакль"/);
assert.match(undoHtml, /aria-label="Отменить: конфликтная пара"/);

console.log("ScenarioDraftEditor UI tests passed");
