import assert from "node:assert/strict";
import { getActivityDateDisplay } from "./getActivityDateDisplay";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  OK ${name}`);
  } catch (error) {
    failed++;
    console.log(`  FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const NOW = new Date("2026-06-10T12:00:00");

test("shows a single future date for one upcoming day", () => {
  assert.equal(
    getActivityDateDisplay(
      { sessions: [{ startsAt: new Date("2026-06-12T10:00:00") }] },
      NOW,
    ),
    "12 июня",
  );
});

test("shows start label for multiple future dates", () => {
  assert.equal(
    getActivityDateDisplay(
      {
        sessions: [
          { startsAt: new Date("2026-06-12T10:00:00") },
          { startsAt: new Date("2026-06-13T10:00:00") },
        ],
      },
      NOW,
    ),
    "с 12 июня",
  );
});

test("shows end label while event is ongoing", () => {
  assert.equal(
    getActivityDateDisplay(
      {
        sessions: [
          { startsAt: new Date("2026-06-08T10:00:00") },
          { startsAt: new Date("2026-06-30T10:00:00") },
        ],
      },
      NOW,
    ),
    "до 30 июня",
  );
});

test("shows until today when the event ends today", () => {
  assert.equal(
    getActivityDateDisplay(
      {
        sessions: [
          { startsAt: new Date("2026-06-08T10:00:00") },
          { startsAt: new Date("2026-06-10T18:00:00") },
        ],
      },
      NOW,
    ),
    "до сегодня",
  );
});

test("shows past label after event end", () => {
  assert.equal(
    getActivityDateDisplay(
      {
        sessions: [
          { startsAt: new Date("2026-06-06T10:00:00") },
          { startsAt: new Date("2026-06-07T10:00:00") },
        ],
      },
      NOW,
    ),
    "Уже прошло",
  );
});

test("falls back to scheduleJson dates when sessions are absent", () => {
  assert.equal(
    getActivityDateDisplay(
      {
        scheduleJson: {
          dates: [{ isoDate: "2026-06-12" }, { isoDate: "2026-06-13" }],
        },
      },
      NOW,
    ),
    "с 12 июня",
  );
});

console.log(`\n${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  process.exit(1);
}
