import assert from "node:assert/strict";
import { format, parseISO, startOfISOWeek } from "date-fns";

import { SEO_BASELINE } from "../../config/seo-baseline";
import {
  compoundWeeklyRate,
  getBaselineForWeek,
  getEvergreenClicks,
  getGateStatus,
  getOperationalRecoveryWindow,
  getPairedRecoveryWindow,
  getRecoveryShare,
  getRequiredShareGain,
  getRequiredShareGainForWindow,
  getRequiredWeeklyGrowth,
  nextIsoWeek,
  recoveryShareFromValues,
} from "./baseline";

const approx = (actual: number | null, expected: number, epsilon = 1e-12) => {
  assert.notEqual(actual, null);
  assert.ok(Math.abs((actual as number) - expected) <= epsilon, `${actual} != ${expected}`);
};

// Final v3.4 evergreen baseline: W44 = 1,891 and unavailable remains distinct from zero.
assert.equal(getBaselineForWeek("2026-W44"), 1891);
assert.equal(getBaselineForWeek("2099-W01"), null);
assert.equal(getBaselineForWeek("2026-W53"), null);

// Recovery can be exactly 100% or exceed it; zero/invalid baselines are unavailable.
approx(getRecoveryShare(1891, "2026-W44"), 1);
approx(getRecoveryShare(3782, "2026-W44"), 2);
assert.equal(recoveryShareFromValues(100, 0), null);
assert.equal(recoveryShareFromValues(100, null), null);
assert.equal(recoveryShareFromValues(Number.NaN, 100), null);

// Compound-rate guards and a known example.
approx(compoundWeeklyRate(100, 200, 4), Math.pow(2, 1 / 4) - 1);
assert.equal(compoundWeeklyRate(0, 200, 4), null);
assert.equal(compoundWeeklyRate(100, 0, 4), null);
assert.equal(compoundWeeklyRate(100, 200, 0), null);
assert.equal(getRequiredWeeklyGrowth(0, "2026-W36"), null);
assert.equal(getRequiredWeeklyGrowth(100, SEO_BASELINE.targetIsoWeek), null);
assert.equal(getRequiredShareGain(100, SEO_BASELINE.targetIsoWeek), null);

// Evergreen aggregation excludes event and unclear URL classes.
assert.equal(
  getEvergreenClicks(
    [
      { isoWeek: "2026-W37", url: "https://mamago.by/", clicks: 10 },
      { isoWeek: "2026-W37", url: "https://mamago.by/minsk/routes/test", clicks: 4 },
      { isoWeek: "2026-W37", url: "https://mamago.by/events/test", clicks: 5 },
      { isoWeek: "2026-W37", url: "https://mamago.by/breakingnews/test", clicks: 2 },
      { isoWeek: "2026-W37", url: "https://mamago.by/minsk/blog/novyj-god-2027-test", clicks: 7 },
    ],
    "2026-W37",
  ),
  14,
);
assert.equal(getEvergreenClicks([], "2026-W37"), null);

// ISO calendar boundaries are library-driven, not week-number arithmetic.
assert.equal(nextIsoWeek("2025-W52"), "2026-W01");
assert.equal(nextIsoWeek("2025-W53"), null);
assert.equal(nextIsoWeek("2026-W53"), "2027-W01");
assert.equal(
  format(startOfISOWeek(parseISO("2026-11-01")), "RRRR-'W'II"),
  "2026-W44",
);

// A rolling window that crosses W53 drops only the unavailable W53 pair.
const yearBoundaryWindow = getPairedRecoveryWindow(
  {
    "2026-W51": 100,
    "2026-W52": 110,
    "2026-W53": 120,
    "2027-W01": 130,
  },
  "2027-W01",
  4,
);
assert.deepEqual(
  yearBoundaryWindow.map((week) => week.isoWeek),
  ["2026-W51", "2026-W52", "2027-W01"],
);

// The cutover week and every earlier week are excluded from paired facts.
const migrationBoundaryWindow = getPairedRecoveryWindow(
  {
    "2026-W34": 1609,
    "2026-W35": 1107,
    "2026-W36": 529,
  },
  "2026-W36",
  4,
);
assert.deepEqual(
  migrationBoundaryWindow.map((week) => week.isoWeek),
  ["2026-W36"],
);

const operationalWindow = getOperationalRecoveryWindow(
  { "2026-W35": 1107, "2026-W36": 529 },
  "2026-W36",
  4,
);
assert.equal(operationalWindow.mode, "single_week_high_noise");
assert.deepEqual(operationalWindow.weeks.map((week) => week.isoWeek), ["2026-W36"]);

// Paired share growth uses the same weeks in numerator and denominator.
const pairedShareGain = getRequiredShareGainForWindow(
  [
    { isoWeek: "2026-W36", actualClicks: 500, baselineClicks: 1000 },
    { isoWeek: "2026-W37", actualClicks: 600, baselineClicks: 1200 },
  ],
  "2026-W37",
);
approx(pairedShareGain, Math.pow(0.8 / 0.5, 1 / 7) - 1);

// Gate status is unavailable when the week has no baseline/fact, never synthetic zero.
assert.equal(getGateStatus("2026-W53"), null);
assert.equal(getGateStatus("2099-W01"), null);

const firstGateStatus = getGateStatus("2026-W36");
assert.notEqual(firstGateStatus, null);
assert.equal(firstGateStatus?.actual, 529);
assert.equal(firstGateStatus?.baseline, 1793);
approx(firstGateStatus?.share ?? null, 529 / 1793);
approx(firstGateStatus?.target ?? null, 529 / 1793);
assert.equal(firstGateStatus?.onTrack, true);

console.log("baseline.test.ts: all assertions passed");
