import assert from "node:assert/strict";
import test from "node:test";

import { resolvePlanItemTimezoneRepair } from "./planItemTimezoneRepair";

test("repairs only the exact Minsk wall-clock-as-UTC legacy value", () => {
  const result = resolvePlanItemTimezoneRepair(
    new Date("2026-08-29T15:00:00.000Z"),
    [{ id: "session-1", startsAt: new Date("2026-08-29T12:00:00.000Z") }],
  );

  assert.equal(result.kind, "legacy-utc-wall-clock");
  if (result.kind !== "legacy-utc-wall-clock") return;
  assert.equal(result.sessionId, "session-1");
  assert.equal(result.startsAt.toISOString(), "2026-08-29T12:00:00.000Z");
});

test("preserves an already canonical UTC instant", () => {
  const result = resolvePlanItemTimezoneRepair(
    new Date("2026-08-29T09:00:00.000Z"),
    [{ id: "session-1", startsAt: new Date("2026-08-29T09:00:00.000Z") }],
  );

  assert.equal(result.kind, "already-correct");
  if (result.kind !== "already-correct") return;
  assert.equal(result.startsAt.toISOString(), "2026-08-29T09:00:00.000Z");
});

test("exact UTC match wins over a different session's legacy wall clock", () => {
  const result = resolvePlanItemTimezoneRepair(
    new Date("2026-08-29T15:00:00.000Z"),
    [
      { id: "canonical-15", startsAt: new Date("2026-08-29T15:00:00.000Z") },
      { id: "legacy-collision", startsAt: new Date("2026-08-29T12:00:00.000Z") },
    ],
  );

  assert.equal(result.kind, "already-correct");
  if (result.kind !== "already-correct") return;
  assert.equal(result.sessionId, "canonical-15");
});

test("refuses ambiguous legacy matches", () => {
  const result = resolvePlanItemTimezoneRepair(
    new Date("2026-08-29T15:00:00.000Z"),
    [
      { id: "session-1", startsAt: new Date("2026-08-29T12:00:00.000Z") },
      { id: "session-2", startsAt: new Date("2026-08-29T12:00:00.000Z") },
    ],
  );

  assert.equal(result.kind, "unresolved");
});
