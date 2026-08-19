import assert from "node:assert/strict";

import { planRouteNoteHtmlFixes } from "./planRouteNoteHtmlFixes";

function testFlagsOnlyStopsWithHtml() {
  const candidates = planRouteNoteHtmlFixes([
    {
      id: "route-1",
      title: "Family Route",
      stops: [
        { id: "stop-1", order: 1, note: "<p>Raw <strong>HTML</strong> note.</p>" },
        { id: "stop-2", order: 2, note: "Already plain text." },
      ],
    },
  ]);

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].stopId, "stop-1");
  assert.equal(candidates[0].routeId, "route-1");
  assert.equal(candidates[0].routeTitle, "Family Route");
  assert.equal(candidates[0].order, 1);
  assert.equal(candidates[0].before, "<p>Raw <strong>HTML</strong> note.</p>");
  assert.equal(candidates[0].after, "Raw HTML note.");
}

function testEmptyWhenAllStopsAlreadyPlain() {
  const candidates = planRouteNoteHtmlFixes([
    {
      id: "route-1",
      title: "Family Route",
      stops: [
        { id: "stop-1", order: 1, note: "Already plain text." },
        { id: "stop-2", order: 2, note: "Another plain note." },
      ],
    },
  ]);
  assert.deepEqual(candidates, []);
}

function testReRunningOnItsOwnOutputProducesNoCandidates() {
  // Simulates the "second dry-run after --apply" check the task asks for.
  const first = planRouteNoteHtmlFixes([
    { id: "route-1", title: "R", stops: [{ id: "stop-1", order: 1, note: "<p>Raw HTML.</p>" }] },
  ]);
  assert.equal(first.length, 1);

  const second = planRouteNoteHtmlFixes([
    { id: "route-1", title: "R", stops: [{ id: "stop-1", order: 1, note: first[0].after }] },
  ]);
  assert.deepEqual(second, []);
}

function testMultipleRoutesAndStopsPreserveOrder() {
  const candidates = planRouteNoteHtmlFixes([
    {
      id: "route-1",
      title: "Route One",
      stops: [
        { id: "r1-stop-1", order: 1, note: "<p>A</p>" },
        { id: "r1-stop-2", order: 2, note: "plain" },
      ],
    },
    {
      id: "route-2",
      title: "Route Two",
      stops: [{ id: "r2-stop-1", order: 1, note: "<p>B</p>" }],
    },
  ]);

  assert.deepEqual(
    candidates.map((c) => c.stopId),
    ["r1-stop-1", "r2-stop-1"],
  );
}

function main() {
  testFlagsOnlyStopsWithHtml();
  testEmptyWhenAllStopsAlreadyPlain();
  testReRunningOnItsOwnOutputProducesNoCandidates();
  testMultipleRoutesAndStopsPreserveOrder();
}

main();
console.log("planRouteNoteHtmlFixes tests: OK");
