import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { ScenarioConflictCluster, ScenarioUndoStatus, formatScenarioTimeRange, type ScenarioStyles } from "./scenarioTimelineParts";
import type { ScenarioClientItem } from "@/features/my-plan/lib/scenarioDraft";

// A stub CSS-module lookup — `.css` module imports crash under this
// project's plain `tsx <file>.test.ts` runner (no bundler asset pipeline),
// so these presentational components take `styles` as a prop instead of
// importing the real module. Every accessed class name resolves to itself.
const styles: ScenarioStyles = new Proxy({} as ScenarioStyles, { get: (_target, prop) => String(prop) });

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
    priceLabel: null,
    addressLabel: null,
    isBooked: false,
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
const noCandidates = () => [];

function cluster(conflictKey: string, items: ScenarioClientItem[]) {
  return (
    <ScenarioConflictCluster
      conflictKey={conflictKey}
      items={items}
      styles={styles}
      onRemove={noop}
      onKeepBoth={noop}
      replacementFor={null}
      loadingCandidates={false}
      candidatesFor={noCandidates}
      onRequestReplacement={noop}
      onPickReplacement={noop}
    />
  );
}

const html = renderToStaticMarkup(
  <>
    {cluster("one:two", firstPair)}
    {cluster("three:four", secondPair)}
  </>,
);

assert.equal(formatScenarioTimeRange(firstPair[0]!), "08:00");
assert.match(html, /id="conflict-one-two"/);
assert.match(html, /id="conflict-three-four"/);
assert.match(html, />Спектакль</);
assert.match(html, />Мастер-класс</);
assert.match(html, /aria-label="Оставить: Спектакль"/);
assert.match(html, /aria-label="Оставить: Мастер-класс"/);
assert.match(html, /aria-label="Оставить оба: Спектакль и Мастер-класс"/);
assert.equal((html.match(/Конфликт/g) ?? []).length, 2);
assert.equal((html.match(/Оставить оба, разберусь позже/g) ?? []).length, 2);
// Nothing kept yet in a static render — no swap rail, no per-item delete link.
assert.doesNotMatch(html, /Предложить замену/);
assert.doesNotMatch(html, /Удалить «/);

const undoHtml = renderToStaticMarkup(
  <>
    <ScenarioUndoStatus label="Заменено" targetTitle="Спектакль" styles={styles} onUndo={noop} />
    <ScenarioUndoStatus label="Удалено из черновика" targetTitle="Мастер-класс" styles={styles} onUndo={noop} />
    <ScenarioUndoStatus label="Оставлены оба" targetTitle="конфликтная пара" styles={styles} actionLabel="Отменить" onUndo={noop} />
  </>,
);
assert.match(undoHtml, /Заменено/);
assert.match(undoHtml, /Удалено из черновика/);
assert.match(undoHtml, /Оставлены оба/);
assert.match(undoHtml, /aria-label="Вернуть: Спектакль"/);
assert.match(undoHtml, /aria-label="Отменить: конфликтная пара"/);

console.log("scenarioTimelineParts UI tests passed");
